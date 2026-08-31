import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFlowControlApplication,
  type TowerSnapshot,
} from "./application";

const EXPECTED_AIRPORT_GEOMETRY = {
  id: "FLOW",
  name: "Flow Field",
  referencePoint: { eastNauticalMiles: 0, northNauticalMiles: 0 },
  localControlBoundary: {
    shape: "circle",
    center: { eastNauticalMiles: 0, northNauticalMiles: 0 },
    radiusNauticalMiles: 8,
  },
  runways: [
    {
      id: "09-27",
      role: "primary",
      center: { eastNauticalMiles: 0, northNauticalMiles: 0 },
      headingDegrees: 90,
      lengthFeet: 11_500,
      widthFeet: 150,
      runwayEnds: ["09", "27"],
    },
    {
      id: "04-22",
      role: "crosswind",
      center: { eastNauticalMiles: 0, northNauticalMiles: 0 },
      headingDegrees: 40,
      lengthFeet: 5_500,
      widthFeet: 100,
      runwayEnds: ["04", "22"],
    },
  ],
  intersections: [
    {
      id: "primary-crosswind",
      runwayIds: ["09-27", "04-22"],
      position: { eastNauticalMiles: 0, northNauticalMiles: 0 },
    },
  ],
  circuits: [
    {
      id: "runway-09-left",
      runwayId: "09-27",
      runwayEnd: "09",
      direction: "left",
      altitudeFeetAgl: 1_000,
      legs: [
        {
          id: "upwind",
          from: { eastNauticalMiles: 0.95, northNauticalMiles: 0 },
          to: { eastNauticalMiles: 2, northNauticalMiles: 0 },
        },
        {
          id: "crosswind",
          from: { eastNauticalMiles: 2, northNauticalMiles: 0 },
          to: { eastNauticalMiles: 2, northNauticalMiles: 1.5 },
        },
        {
          id: "downwind",
          from: { eastNauticalMiles: 2, northNauticalMiles: 1.5 },
          to: { eastNauticalMiles: -2, northNauticalMiles: 1.5 },
        },
        {
          id: "base",
          from: { eastNauticalMiles: -2, northNauticalMiles: 1.5 },
          to: { eastNauticalMiles: -2, northNauticalMiles: 0 },
        },
        {
          id: "final",
          from: { eastNauticalMiles: -2, northNauticalMiles: 0 },
          to: { eastNauticalMiles: -0.95, northNauticalMiles: 0 },
        },
      ],
    },
  ],
  holdingAreas: [
    {
      id: "northwest-hold",
      name: "Northwest Hold",
      center: { eastNauticalMiles: -3.5, northNauticalMiles: 3.5 },
      radiusNauticalMiles: 0.75,
    },
    {
      id: "southeast-hold",
      name: "Southeast Hold",
      center: { eastNauticalMiles: 3.5, northNauticalMiles: -3.5 },
      radiusNauticalMiles: 0.75,
    },
  ],
} as const;

const EXPECTED_AIRCRAFT_CAPABILITY_PROFILES = [
  {
    id: "cessna-172",
    displayName: "Cessna 172",
    wakeCategory: "light",
    approachSpeedKnots: 65,
    cruiseSpeedKnots: 110,
    climbRateFeetPerMinute: 700,
    minimumRunway: { lengthFeet: 2_500, widthFeet: 75 },
    manoeuvring: {
      circuitEligible: true,
      localHoldEligible: true,
      threeSixtyEligible: true,
    },
  },
  {
    id: "king-air-350",
    displayName: "King Air 350",
    wakeCategory: "medium",
    approachSpeedKnots: 105,
    cruiseSpeedKnots: 270,
    climbRateFeetPerMinute: 1_800,
    minimumRunway: { lengthFeet: 4_000, widthFeet: 100 },
    manoeuvring: {
      circuitEligible: true,
      localHoldEligible: true,
      threeSixtyEligible: true,
    },
  },
  {
    id: "atr-72-600",
    displayName: "ATR 72-600",
    wakeCategory: "medium",
    approachSpeedKnots: 120,
    cruiseSpeedKnots: 275,
    climbRateFeetPerMinute: 1_500,
    minimumRunway: { lengthFeet: 4_500, widthFeet: 100 },
    manoeuvring: {
      circuitEligible: false,
      localHoldEligible: true,
      threeSixtyEligible: true,
    },
  },
  {
    id: "boeing-737-8",
    displayName: "Boeing 737-8",
    wakeCategory: "medium",
    approachSpeedKnots: 140,
    cruiseSpeedKnots: 450,
    climbRateFeetPerMinute: 2_500,
    minimumRunway: { lengthFeet: 6_500, widthFeet: 150 },
    manoeuvring: {
      circuitEligible: false,
      localHoldEligible: true,
      threeSixtyEligible: true,
    },
  },
  {
    id: "airbus-a330-900",
    displayName: "Airbus A330-900",
    wakeCategory: "heavy",
    approachSpeedKnots: 145,
    cruiseSpeedKnots: 470,
    climbRateFeetPerMinute: 1_800,
    minimumRunway: { lengthFeet: 9_500, widthFeet: 150 },
    manoeuvring: {
      circuitEligible: false,
      localHoldEligible: true,
      threeSixtyEligible: true,
    },
  },
] as const;

describe("Shift lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("begins an armed Observe Shift for the connecting Tower Agent", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });

    expect(application.query({ type: "available-capabilities" })).toEqual([
      "begin_tower_shift",
    ]);

    const result = application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 1,
      summary: "Tower Agent connected; Shift phase-0 is active in Observe.",
      nextAction: "get_tower_snapshot",
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
    ]);
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      shiftStatus: "active",
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      stateVersion: 1,
    });
    expect(application.query({ type: "operational-receipts" })).toEqual([
      expect.objectContaining({
        actor: "tower-agent",
        action: "shift-began",
        stateVersionBefore: 0,
        stateVersionAfter: 1,
      }),
    ]);
  });

  it("replays the same fixed-timestep command sequence deterministically", () => {
    const runShift = () => {
      const application = createFlowControlApplication({
        scenarioSeed: "phase-1-tracer",
        operatingPosture: "observe",
        simulation: {
          fixedTimeStepMs: 100,
          paceMultiplier: 1.5,
        },
      });

      application.command({
        type: "begin-shift",
        actor: "tower-agent",
        expectedStateVersion: 0,
      });
      application.command({
        type: "advance-simulation",
        actor: "simulation-clock",
      });
      application.command({
        type: "advance-simulation",
        actor: "simulation-clock",
      });

      return {
        snapshot: application.query({ type: "tower-snapshot" }),
        receipts: application.query({ type: "operational-receipts" }),
      };
    };

    const firstRun = runShift();
    const replay = runShift();

    expect(replay).toEqual(firstRun);
    expect(firstRun).toEqual({
      snapshot: {
        shiftStatus: "active",
        scenarioSeed: "phase-1-tracer",
        operatingPosture: "observe",
        pendingOperatingPosture: undefined,
        capabilitySynchronization: undefined,
        stagedClearancePlanReference: undefined,
        simulationTimeMs: 300,
        stateVersion: 1,
        weather: {
          preset: "light-northerly",
          windDirectionDegrees: 350,
          windSpeedKnots: 6,
          visibilityStatuteMiles: 10,
          ceilingFeet: 6_000,
        },
        airport: EXPECTED_AIRPORT_GEOMETRY,
        aircraftCapabilityProfiles: EXPECTED_AIRCRAFT_CAPABILITY_PROFILES,
        aircraft: expect.any(Array),
      },
      receipts: [
        {
          actor: "tower-agent",
          action: "shift-began",
          simulationTimeMs: 0,
          stateVersionBefore: 0,
          stateVersionAfter: 1,
        },
      ],
    });
  });

  it("uses the Scenario Seed to select reproducible static VFR weather", () => {
    const snapshotFor = (scenarioSeed: string) =>
      createFlowControlApplication({
        scenarioSeed,
        operatingPosture: "observe",
      }).query({ type: "tower-snapshot" });

    const firstRun = snapshotFor("phase-1-weather-alpha");

    expect(snapshotFor("phase-1-weather-alpha")).toEqual(firstRun);
    expect(firstRun).toMatchObject({
      weather: {
        preset: "light-northerly",
        windDirectionDegrees: 350,
        windSpeedKnots: 6,
        visibilityStatuteMiles: 10,
        ceilingFeet: 6_000,
      },
    });
    expect(snapshotFor("phase-1-weather-bravo")).toMatchObject({
      weather: {
        preset: "westerly",
        windDirectionDegrees: 270,
        windSpeedKnots: 10,
        visibilityStatuteMiles: 10,
        ceilingFeet: 5_000,
      },
    });
  });

  it("exposes the fictional airport as explicit operational geometry", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-1-airport",
      operatingPosture: "observe",
    });

    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      airport: EXPECTED_AIRPORT_GEOMETRY,
    });
  });

  it("exposes illustrative capability profiles for every supported aircraft type", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-1-aircraft-capabilities",
      operatingPosture: "observe",
    });

    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      aircraftCapabilityProfiles: EXPECTED_AIRCRAFT_CAPABILITY_PROFILES,
    });
  });

  it("advances a seeded roster through deterministic aircraft and Pilot states", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-1-aircraft-lifecycle",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const initialSnapshot = application.query({
      type: "tower-snapshot",
    }) as TowerSnapshot;
    expect(
      initialSnapshot.aircraft.map(
        ({ callsign, capabilityProfileId, flightPhase, pilotState }) => ({
          callsign,
          capabilityProfileId,
          flightPhase,
          pilotState,
        }),
      ),
    ).toEqual([
      {
        callsign: "FLOW 101",
        capabilityProfileId: "cessna-172",
        flightPhase: "hold-short",
        pilotState: "ready",
      },
      {
        callsign: "FLOW 202",
        capabilityProfileId: "king-air-350",
        flightPhase: "inbound",
        pilotState: "awaiting-contact",
      },
      {
        callsign: "FLOW 303",
        capabilityProfileId: "atr-72-600",
        flightPhase: "inbound",
        pilotState: "awaiting-contact",
      },
      {
        callsign: "FLOW 404",
        capabilityProfileId: "boeing-737-8",
        flightPhase: "hold-short",
        pilotState: "ready",
      },
      {
        callsign: "FLOW 505",
        capabilityProfileId: "airbus-a330-900",
        flightPhase: "inbound",
        pilotState: "awaiting-contact",
      },
      {
        callsign: "FLOW 106",
        capabilityProfileId: "cessna-172",
        flightPhase: "circuit",
        pilotState: "monitoring",
      },
    ]);

    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 100,
    });
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot).aircraft[0],
    ).toMatchObject({
      callsign: "FLOW 101",
      flightPhase: "departure",
      pilotState: "operating",
    });

    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 2_000,
    });
    const completedSnapshot = application.query({
      type: "tower-snapshot",
    }) as TowerSnapshot;
    expect(completedSnapshot.simulationTimeMs).toBe(210_000);
    expect(
      completedSnapshot.aircraft.map(
        ({ callsign, flightPhase, pilotState, exit }) => ({
          callsign,
          flightPhase,
          pilotState,
          exit,
        }),
      ),
    ).toEqual([
      {
        callsign: "FLOW 101",
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: "departed",
      },
      {
        callsign: "FLOW 202",
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: "landed",
      },
      {
        callsign: "FLOW 303",
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: "landed",
      },
      {
        callsign: "FLOW 404",
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: "departed",
      },
      {
        callsign: "FLOW 505",
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: "landed",
      },
      {
        callsign: "FLOW 106",
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: "landed",
      },
    ]);
    expect(
      (
        application.query({ type: "operational-receipts" }) as Array<{
          action: string;
        }>
      )
        .filter(
          (receipt) => receipt.action === "aircraft-state-transition",
        ),
    ).toHaveLength(12);
  });

  it("returns a bounded heartbeat while the Tower Agent monitors an active Shift", async () => {
    vi.useFakeTimers();
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const waiting = application.query({
      type: "wait-for-tower-event",
      cursor: 0,
      heartbeatAfterMs: 1_000,
    });
    let resolved = false;
    void Promise.resolve(waiting).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(waiting).resolves.toEqual({
      eventKind: "heartbeat",
      priority: "routine",
      cursor: 0,
      stateVersion: 1,
      simulationTime: 0,
      summary: "Tower Agent monitoring is current.",
      actionRequired: false,
    });
  });

  it("publishes the active snapshot when the Tower Agent begins the Shift", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    const publishedSnapshots: unknown[] = [];
    application.subscribe((snapshot) => {
      publishedSnapshots.push(snapshot);
    });

    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(publishedSnapshots).toEqual([
      expect.objectContaining({
        shiftStatus: "active",
        stateVersion: 1,
      }),
    ]);
  });

  it("refuses a stale begin call without starting the Shift", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });

    const result = application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 7,
    });

    expect(result).toEqual({
      status: "stale",
      stateVersion: 0,
      summary: "Shift start refused because the expected State Version is stale.",
      rationale: "Expected State Version 7; current State Version is 0.",
      nextAction: "get_tower_snapshot",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      shiftStatus: "armed",
      stateVersion: 0,
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "begin_tower_shift",
    ]);
    expect(application.query({ type: "operational-receipts" })).toEqual([]);
  });

  it("refuses a cached begin call after the Shift is already active", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "refusal",
      stateVersion: 1,
      summary: "Shift start refused because the Shift is already active.",
    });
    expect(application.query({ type: "operational-receipts" })).toHaveLength(1);
  });

  it("refuses monitoring before the Shift is active", async () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });

    await expect(
      application.query({
        type: "wait-for-tower-event",
        cursor: 0,
        heartbeatAfterMs: 1,
      }),
    ).resolves.toMatchObject({
      eventKind: "monitoring-unavailable",
      stateVersion: 0,
      actionRequired: true,
    });
  });

  it("exposes delegated operational capabilities in Take the Sector", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
      "stage_clearance_plan",
      "stage_recovery_plan",
      "issue_runway_clearance",
      "issue_tactical_instruction",
    ]);
  });

  it("immediately reduces Tower Agent capability when the Supervising Controller selects Observe", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "reduce-operating-posture",
      actor: "supervising-controller",
      operatingPosture: "observe",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 2,
      summary: "Operating Posture reduced to Observe.",
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
    ]);
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      stateVersion: 2,
    });
  });

  it("keeps an authority increase pending without expanding active capability", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "reduce-operating-posture",
      actor: "supervising-controller",
      operatingPosture: "observe",
      expectedStateVersion: 1,
    });

    const result = application.command({
      type: "request-operating-posture-increase",
      actor: "supervising-controller",
      operatingPosture: "take-the-sector",
      expectedStateVersion: 2,
    });

    expect(result).toMatchObject({
      status: "approval-required",
      stateVersion: 3,
      summary: "Take the Sector grant is pending human confirmation.",
      nextAction: "confirm-operating-posture-increase",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      pendingOperatingPosture: "take-the-sector",
      stateVersion: 3,
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
    ]);
  });

  it("requests expanded registration only after explicit grant confirmation", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "request-operating-posture-increase",
      actor: "supervising-controller",
      operatingPosture: "take-the-sector",
      expectedStateVersion: 1,
    });

    const result = application.command({
      type: "confirm-operating-posture-increase",
      actor: "supervising-controller",
      expectedStateVersion: 2,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 3,
      summary:
        "Take the Sector grant confirmed; capability synchronization is pending.",
      nextAction: "synchronize-capabilities",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      pendingOperatingPosture: "take-the-sector",
      capabilitySynchronization: "pending",
      stateVersion: 3,
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(5);
    expect(
      application.query({ type: "capabilities-to-register" }),
    ).toHaveLength(9);
  });

  it("reports warning and unavailable connection states after Tower Agent silence", () => {
    let wallClockTime = 0;
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      wallClockNow: () => wallClockTime,
      connectionLease: {
        warningAfterMs: 1_000,
        unavailableAfterMs: 2_000,
      },
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    wallClockTime = 999;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "healthy",
      silenceMs: 999,
    });

    wallClockTime = 1_000;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "warning",
      silenceMs: 1_000,
    });

    wallClockTime = 2_000;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "unavailable",
      silenceMs: 2_000,
    });
  });

  it("briefly reports reconnection after contact resumes from an expired lease", () => {
    let wallClockTime = 0;
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      wallClockNow: () => wallClockTime,
      connectionLease: {
        warningAfterMs: 1_000,
        unavailableAfterMs: 2_000,
        reconnectedForMs: 1_000,
      },
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    wallClockTime = 2_000;
    expect(application.query({ type: "connection-health" })).toMatchObject({
      state: "unavailable",
    });

    application.command({
      type: "renew-agent-lease",
      actor: "capability-registry",
    });

    expect(application.query({ type: "connection-health" })).toEqual({
      state: "reconnected",
      silenceMs: 0,
    });
    wallClockTime = 2_999;
    expect(application.query({ type: "connection-health" })).toMatchObject({
      state: "reconnected",
    });
    application.command({
      type: "renew-agent-lease",
      actor: "capability-registry",
    });
    wallClockTime = 3_000;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "healthy",
      silenceMs: 1,
    });
  });

  it("resolves an aborted tower-event wait as a semantic cancellation", async () => {
    vi.useFakeTimers();
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    const controller = new AbortController();

    const waiting = application.query({
      type: "wait-for-tower-event",
      cursor: 4,
      heartbeatAfterMs: 5_000,
      signal: controller.signal,
    });
    controller.abort();

    await expect(waiting).resolves.toMatchObject({
      eventKind: "wait-cancelled",
      cursor: 4,
      stateVersion: 1,
      actionRequired: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refuses a cached Clearance Plan mutation while active in Observe", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "phase-0-check",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "refusal",
      stateVersion: 1,
      summary: "Clearance Plan staging requires Assist or Take the Sector.",
      nextAction: "request-authority-increase",
    });
    expect(application.query({ type: "operational-receipts" })).toHaveLength(1);
  });

  it("stages a reversible Clearance Plan while active in Assist", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "phase-0-check",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 2,
      summary: "Clearance Plan phase-0-check staged for human review.",
      nextAction: "await-plan-review",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlanReference: "phase-0-check",
      stateVersion: 2,
    });
    expect(application.query({ type: "operational-receipts" })).toEqual([
      expect.objectContaining({ action: "shift-began" }),
      expect.objectContaining({
        actor: "tower-agent",
        action: "clearance-plan-staged",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
      }),
    ]);
  });
});
