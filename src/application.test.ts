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
        categoryOverrides: {},
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
        runwayResources: expect.any(Object),
        transmissions: [],
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

  it("models runway and intersection occupancy as shared timed resources", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-1-runway-resources",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
        .runwayResources,
    ).toEqual({ runwayOccupancy: [], intersectionOccupancy: [] });

    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 100,
    });
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
        .runwayResources,
    ).toEqual({
      runwayOccupancy: [
        {
          runwayId: "09-27",
          aircraftId: "fc-101",
          callsign: "FLOW 101",
          operation: "departure",
          clearsAtSimulationTimeMs: 30_000,
        },
      ],
      intersectionOccupancy: [
        {
          intersectionId: "primary-crosswind",
          aircraftIds: ["fc-101"],
          runwayIds: ["09-27"],
        },
      ],
    });

    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 200,
    });
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
        .runwayResources,
    ).toEqual({
      runwayOccupancy: [
        {
          runwayId: "04-22",
          aircraftId: "fc-202",
          callsign: "FLOW 202",
          operation: "arrival",
          clearsAtSimulationTimeMs: 40_000,
        },
      ],
      intersectionOccupancy: [
        {
          intersectionId: "primary-crosswind",
          aircraftIds: ["fc-202"],
          runwayIds: ["04-22"],
        },
      ],
    });

    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 1_800,
    });
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
        .runwayResources,
    ).toEqual({ runwayOccupancy: [], intersectionOccupancy: [] });
  });

  it("records structured Clearances, Tactical Instructions, and delayed Pilot readbacks", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-1-command-vocabulary",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const runwayResult = application.command({
      type: "issue-runway-clearance",
      actor: "supervising-controller",
      aircraftId: "fc-101",
      clearance: {
        kind: "clear-for-takeoff",
        runwayId: "09-27",
        runwayEnd: "09",
      },
      expectedStateVersion: 1,
    });
    expect(runwayResult).toMatchObject({
      status: "success",
      stateVersion: 2,
      nextAction: "continue",
    });

    const tacticalResult = application.command({
      type: "issue-tactical-instruction",
      actor: "supervising-controller",
      aircraftId: "fc-202",
      instruction: {
        headingDegrees: 120,
        altitudeFeet: 3_000,
        speedKnots: 170,
      },
      expectedStateVersion: 2,
    });
    expect(tacticalResult).toMatchObject({
      status: "success",
      stateVersion: 3,
      nextAction: "continue",
    });

    const issuedSnapshot = application.query({
      type: "tower-snapshot",
    }) as TowerSnapshot;
    expect(
      issuedSnapshot.aircraft.find(({ id }) => id === "fc-101"),
    ).toMatchObject({
      activeRunwayClearance: {
        kind: "clear-for-takeoff",
        runwayId: "09-27",
        runwayEnd: "09",
      },
      pilotState: "awaiting-readback",
    });
    expect(
      issuedSnapshot.aircraft.find(({ id }) => id === "fc-202"),
    ).toMatchObject({
      activeTacticalInstruction: {
        headingDegrees: 120,
        altitudeFeet: 3_000,
        speedKnots: 170,
      },
      pilotState: "awaiting-readback",
    });
    expect(issuedSnapshot.transmissions).toEqual([
      {
        sequence: 1,
        speaker: "controller",
        aircraftId: "fc-101",
        text: "FLOW 101, cleared for takeoff runway 09.",
        simulationTimeMs: 0,
      },
      {
        sequence: 2,
        speaker: "controller",
        aircraftId: "fc-202",
        text: "FLOW 202, heading 120, altitude 3000 feet, speed 170 knots.",
        simulationTimeMs: 0,
      },
    ]);

    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 10,
    });
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
        .transmissions,
    ).toEqual([
      {
        sequence: 1,
        speaker: "controller",
        aircraftId: "fc-101",
        text: "FLOW 101, cleared for takeoff runway 09.",
        simulationTimeMs: 0,
      },
      {
        sequence: 2,
        speaker: "controller",
        aircraftId: "fc-202",
        text: "FLOW 202, heading 120, altitude 3000 feet, speed 170 knots.",
        simulationTimeMs: 0,
      },
      {
        sequence: 3,
        speaker: "pilot",
        aircraftId: "fc-101",
        text: "FLOW 101, cleared for takeoff runway 09.",
        simulationTimeMs: 1_000,
      },
      {
        sequence: 4,
        speaker: "pilot",
        aircraftId: "fc-202",
        text: "FLOW 202, heading 120, altitude 3000 feet, speed 170 knots.",
        simulationTimeMs: 1_000,
      },
    ]);
  });

  it("evaluates a proposed runway Clearance against occupied runway and intersection resources without changing the Shift", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-conflict-evaluation",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 100,
    });

    const beforeEvaluation = {
      snapshot: application.query({ type: "tower-snapshot" }),
      receipts: application.query({ type: "operational-receipts" }),
    };

    expect(
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: 3,
        runwayClearances: [
          {
            aircraftId: "fc-404",
            clearance: {
              kind: "clear-for-takeoff",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          },
        ],
      }),
    ).toEqual({
      status: "refusal",
      valid: false,
      evaluatedStateVersion: 3,
      simulationTimeMs: 10_000,
      classification: "routine",
      affectedAircraft: ["fc-101", "fc-404"],
      conflicts: [
        {
          kind: "runway-occupied",
          resourceId: "09-27",
          aircraftIds: ["fc-101", "fc-404"],
        },
        {
          kind: "intersection-occupied",
          resourceId: "primary-crosswind",
          aircraftIds: ["fc-101", "fc-404"],
        },
      ],
      constraints: [],
      mustIssueBySimulationTimeMs: 30_000,
      nextAction: "wait-for-runway-resource",
    });

    expect({
      snapshot: application.query({ type: "tower-snapshot" }),
      receipts: application.query({ type: "operational-receipts" }),
    }).toEqual(beforeEvaluation);
  });

  it("refuses a runway Clearance whose aircraft capability minimum exceeds the runway", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-runway-capability",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: 1,
        runwayClearances: [
          {
            aircraftId: "fc-505",
            clearance: {
              kind: "clear-to-land",
              runwayId: "04-22",
              runwayEnd: "22",
            },
          },
        ],
      }),
    ).toEqual({
      status: "refusal",
      valid: false,
      evaluatedStateVersion: 1,
      simulationTimeMs: 0,
      classification: "routine",
      affectedAircraft: ["fc-505"],
      conflicts: [],
      constraints: [
        {
          kind: "runway-capability",
          aircraftId: "fc-505",
          resourceId: "04-22",
          requiredMinimumRunway: { lengthFeet: 9_500, widthFeet: 150 },
          availableRunway: { lengthFeet: 5_500, widthFeet: 100 },
        },
      ],
      nextAction: "select-suitable-runway",
    });
  });

  it("predicts an upcoming shared-intersection conflict at a candidate Clearance's intended time", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-projective-evaluation",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: 1,
        effectiveAtSimulationTimeMs: 30_000,
        runwayClearances: [
          {
            aircraftId: "fc-404",
            clearance: {
              kind: "clear-for-takeoff",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          },
        ],
      }),
    ).toEqual({
      status: "refusal",
      valid: false,
      evaluatedStateVersion: 1,
      simulationTimeMs: 0,
      projectedSimulationTimeMs: 30_000,
      classification: "routine",
      affectedAircraft: ["fc-202", "fc-404", "fc-101"],
      conflicts: [
        {
          kind: "intersection-occupied",
          resourceId: "primary-crosswind",
          aircraftIds: ["fc-202", "fc-404"],
        },
      ],
      constraints: [
        {
          kind: "wake-separation",
          resourceId: "09-27",
          leaderAircraftId: "fc-101",
          followerAircraftId: "fc-404",
          requiredSpacingMs: 5_000,
          availableSpacingMs: 0,
        },
      ],
      mustIssueBySimulationTimeMs: 40_000,
      nextAction: "wait-for-runway-resource",
    });
  });

  it("refuses an arrival sequenced too soon behind a heavy aircraft after runway occupancy clears", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-wake-separation",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: 1,
        effectiveAtSimulationTimeMs: 200_000,
        runwayClearances: [
          {
            aircraftId: "fc-202",
            clearance: {
              kind: "clear-to-land",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          },
        ],
      }),
    ).toEqual({
      status: "refusal",
      valid: false,
      evaluatedStateVersion: 1,
      simulationTimeMs: 0,
      projectedSimulationTimeMs: 200_000,
      classification: "routine",
      affectedAircraft: ["fc-505", "fc-202"],
      conflicts: [],
      constraints: [
        {
          kind: "wake-separation",
          resourceId: "09-27",
          leaderAircraftId: "fc-505",
          followerAircraftId: "fc-202",
          requiredSpacingMs: 20_000,
          availableSpacingMs: 10_000,
        },
      ],
      nextAction: "delay-for-wake-separation",
    });
  });

  it("classifies routine work, Immediate Protection, and a multi-aircraft recovery deterministically", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-action-classification",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const evaluate = (runwayClearances: Array<{
      aircraftId: string;
      clearance: {
        kind: "clear-for-takeoff" | "go-around" | "hold-short";
        runwayId: "09-27" | "04-22";
        runwayEnd: "09" | "27" | "04" | "22";
      };
    }>) =>
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: 1,
        runwayClearances,
      });

    expect(
      evaluate([
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "clear-for-takeoff",
            runwayId: "09-27",
            runwayEnd: "09",
          },
        },
      ]),
    ).toMatchObject({ valid: true, classification: "routine" });
    expect(
      evaluate([
        {
          aircraftId: "fc-202",
          clearance: {
            kind: "go-around",
            runwayId: "04-22",
            runwayEnd: "22",
          },
        },
      ]),
    ).toMatchObject({ valid: true, classification: "elevated" });
    expect(
      evaluate([
        {
          aircraftId: "fc-202",
          clearance: {
            kind: "go-around",
            runwayId: "04-22",
            runwayEnd: "22",
          },
        },
        {
          aircraftId: "fc-404",
          clearance: {
            kind: "hold-short",
            runwayId: "09-27",
            runwayEnd: "09",
          },
        },
      ]),
    ).toMatchObject({ valid: true, classification: "exceptional-recovery" });
  });

  it("applies a Category Override immediately to both Tower Agent capabilities and cached runway calls", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-category-override",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.command({
        type: "set-category-override",
        actor: "supervising-controller",
        category: "runway-clearance",
        disposition: "withheld",
        expectedStateVersion: 1,
      }),
    ).toMatchObject({ status: "success", stateVersion: 2 });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
      "stage_clearance_plan",
      "stage_recovery_plan",
      "issue_tactical_instruction",
    ]);

    expect(
      application.command({
        type: "issue-runway-clearance",
        actor: "tower-agent",
        aircraftId: "fc-101",
        clearance: {
          kind: "clear-for-takeoff",
          runwayId: "09-27",
          runwayEnd: "09",
        },
        expectedStateVersion: 2,
      }),
    ).toEqual({
      status: "refusal",
      stateVersion: 2,
      summary: "Runway Clearance is withheld by Category Override.",
      rationale:
        "The Supervising Controller withheld runway Clearance dispatch from the Tower Agent.",
      nextAction: "wait-for-tower-event",
    });
  });

  it("refuses an unsafe runway Clearance before recording a Transmission or Operational Receipt", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-policy-hard-invariant",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "issue-runway-clearance",
      actor: "tower-agent",
      aircraftId: "fc-505",
      clearance: {
        kind: "clear-to-land",
        runwayId: "04-22",
        runwayEnd: "22",
      },
      expectedStateVersion: 1,
    });

    expect(result).toEqual({
      status: "refusal",
      stateVersion: 1,
      summary: "Runway Clearance refused by policy.",
      rationale:
        "Runway 04-22 cannot satisfy FLOW 505 minimum runway capability.",
      nextAction: "select-suitable-runway",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stateVersion: 1,
      transmissions: [],
    });
    expect(application.query({ type: "operational-receipts" })).toHaveLength(1);
  });

  it("refuses a cached Tower Agent runway Clearance in Observe while preserving manual takeover", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-observe-policy",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.command({
        type: "issue-runway-clearance",
        actor: "tower-agent",
        aircraftId: "fc-101",
        clearance: {
          kind: "clear-for-takeoff",
          runwayId: "09-27",
          runwayEnd: "09",
        },
        expectedStateVersion: 1,
      }),
    ).toEqual({
      status: "refusal",
      stateVersion: 1,
      summary: "Runway Clearance requires Take the Sector.",
      rationale:
        "Observe does not delegate runway Clearance dispatch to the Tower Agent.",
      nextAction: "request-authority-increase",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stateVersion: 1,
      transmissions: [],
    });
  });

  it("refuses a cached Tower Agent Tactical Instruction in Assist", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-assist-policy",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.command({
        type: "issue-tactical-instruction",
        actor: "tower-agent",
        aircraftId: "fc-202",
        instruction: { headingDegrees: 120 },
        expectedStateVersion: 1,
      }),
    ).toEqual({
      status: "refusal",
      stateVersion: 1,
      summary: "Tactical Instruction requires Take the Sector.",
      rationale:
        "Assist does not delegate Tactical Instruction dispatch to the Tower Agent.",
      nextAction: "request-authority-increase",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stateVersion: 1,
      transmissions: [],
    });
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
