import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFlowControlApplication,
  FIRST_LAUNCH_SCENARIO_SEED,
  generateScenario,
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

type FlowControlApplication = ReturnType<typeof createFlowControlApplication>;

const RUNWAY_END_THRESHOLDS: Record<string, { east: number; north: number }> = {
  "09": { east: -0.947, north: 0 },
  "27": { east: 0.947, north: 0 },
  "04": { east: -0.291, north: -0.347 },
  "22": { east: 0.291, north: 0.347 },
};

function advanceSteps(application: FlowControlApplication, steps: number) {
  application.command({
    type: "advance-simulation",
    actor: "simulation-clock",
    steps,
  });
}

function advanceUntil(
  application: FlowControlApplication,
  predicate: (snapshot: TowerSnapshot) => boolean,
  maxSteps = 5_000,
) {
  for (let advanced = 0; advanced < maxSteps; advanced += 10) {
    const snapshot = application.query({
      type: "tower-snapshot",
    }) as TowerSnapshot;
    if (predicate(snapshot)) {
      return snapshot;
    }
    advanceSteps(application, 10);
  }
  const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
  if (!predicate(snapshot)) {
    throw new Error("advanceUntil never satisfied its predicate.");
  }
  return snapshot;
}

function issueManualRunwayClearance(
  application: FlowControlApplication,
  aircraftId: string,
  clearance: {
    kind:
      | "hold-short"
      | "line-up-and-wait"
      | "cancel-runway-clearance"
      | "clear-for-takeoff"
      | "clear-to-land"
      | "clear-touch-and-go"
      | "go-around";
    runwayId: "09-27" | "04-22";
    runwayEnd: "09" | "27" | "04" | "22";
  },
) {
  const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
  return application.command({
    type: "issue-runway-clearance",
    actor: "supervising-controller",
    aircraftId,
    clearance,
    expectedStateVersion: snapshot.stateVersion,
  });
}

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
        controllerScreenName: undefined,
        operatingPosture: "observe",
        categoryOverrides: {},
        pendingOperatingPosture: undefined,
        capabilitySynchronization: undefined,
        stagedClearancePlanReference: undefined,
        stagedClearancePlan: undefined,
        stagedRecoveryPlan: undefined,
        selectedAircraftId: undefined,
        eventCursor: 0,
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
      initialSnapshot.aircraft
        .filter(({ id }) => id !== "fc-108" && id !== "fc-207")
        .map(({ callsign, capabilityProfileId, flightPhase, pilotState }) => ({
          callsign,
          capabilityProfileId,
          flightPhase,
          pilotState,
        })),
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

    advanceSteps(application, 600);
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot).aircraft[0],
    ).toMatchObject({
      callsign: "FLOW 101",
      flightPhase: "hold-short",
      pilotState: "ready",
    });

    issueManualRunwayClearance(application, "fc-101", {
      kind: "clear-for-takeoff",
      runwayId: "09-27",
      runwayEnd: "09",
    });
    const departingSnapshot = advanceUntil(
      application,
      (snapshot) => snapshot.aircraft[0].flightPhase === "departure",
      500,
    );
    expect(departingSnapshot.aircraft[0]).toMatchObject({
      callsign: "FLOW 101",
      flightPhase: "departure",
      pilotState: "operating",
    });

    const departedSnapshot = advanceUntil(
      application,
      (snapshot) => snapshot.aircraft[0].flightPhase === "out-of-play",
      4_000,
    );
    expect(departedSnapshot.aircraft[0]).toMatchObject({
      callsign: "FLOW 101",
      flightPhase: "out-of-play",
      pilotState: "complete",
      exit: "departed",
    });
    expect(
      (
        application.query({ type: "operational-receipts" }) as Array<{
          action: string;
        }>
      ).filter((receipt) => receipt.action === "aircraft-state-transition")
        .length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("lands a cleared arrival causally and leaves an uncleared arrival flying a Pilot-owned go-around", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-5-causal-arrivals",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    issueManualRunwayClearance(application, "fc-202", {
      kind: "clear-to-land",
      runwayId: "04-22",
      runwayEnd: "04",
    });

    const landedSnapshot = advanceUntil(
      application,
      (snapshot) =>
        snapshot.aircraft.find(({ id }) => id === "fc-202")?.flightPhase ===
        "out-of-play",
      4_000,
    );
    expect(landedSnapshot.aircraft.find(({ id }) => id === "fc-202")).toMatchObject(
      {
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: "landed",
      },
    );

    advanceUntil(
      application,
      () =>
        (
          application.query({ type: "operational-receipts" }) as Array<{
            action: string;
          }>
        ).some((receipt) => receipt.action === "pilot-go-around-executed"),
      6_000,
    );
    const uncleardArrival = (
      application.query({ type: "tower-snapshot" }) as TowerSnapshot
    ).aircraft.find(({ id }) => id === "fc-303");
    expect(uncleardArrival).toMatchObject({ flightPhase: "approach" });
    expect(
      (
        application.query({ type: "transmissions" }) as Array<{
          speaker: string;
          text: string;
        }>
      ).some(
        ({ speaker, text }) =>
          speaker === "pilot" && text.startsWith("FLOW 303, going around"),
      ),
    ).toBe(true);
  });

  it("keeps an uncleared circuit aircraft flying its authored legs without touching the runway", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-5-circuit-extend",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const initialPosition = (
      application.query({ type: "tower-snapshot" }) as TowerSnapshot
    ).aircraft.find(({ id }) => id === "fc-106")?.position;
    advanceSteps(application, 4_500);
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const circuitAircraft = snapshot.aircraft.find(({ id }) => id === "fc-106");
    expect(circuitAircraft).toMatchObject({ flightPhase: "circuit" });
    expect(circuitAircraft?.position).not.toEqual(initialPosition);
    expect(
      snapshot.runwayResources.runwayOccupancy.filter(
        ({ aircraftId }) => aircraftId === "fc-106",
      ),
    ).toEqual([]);
  });

  it("touches and goes only under a Clearance and lands the circuit full-stop when cleared to land", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-5-circuit-clearances",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    issueManualRunwayClearance(application, "fc-106", {
      kind: "clear-touch-and-go",
      runwayId: "09-27",
      runwayEnd: "09",
    });
    const touchSnapshot = advanceUntil(
      application,
      (snapshot) =>
        snapshot.runwayResources.runwayOccupancy.some(
          ({ aircraftId }) => aircraftId === "fc-106",
        ),
      4_000,
    );
    expect(
      touchSnapshot.runwayResources.runwayOccupancy.find(
        ({ aircraftId }) => aircraftId === "fc-106",
      ),
    ).toMatchObject({ runwayId: "09-27", operation: "arrival" });
    expect(
      touchSnapshot.aircraft.find(({ id }) => id === "fc-106"),
    ).toMatchObject({ flightPhase: "circuit" });

    advanceUntil(
      application,
      (snapshot) => snapshot.runwayResources.runwayOccupancy.length === 0,
      200,
    );
    issueManualRunwayClearance(application, "fc-106", {
      kind: "clear-to-land",
      runwayId: "09-27",
      runwayEnd: "09",
    });
    const landedSnapshot = advanceUntil(
      application,
      (snapshot) =>
        snapshot.aircraft.find(({ id }) => id === "fc-106")?.flightPhase ===
        "out-of-play",
      5_000,
    );
    expect(landedSnapshot.aircraft.find(({ id }) => id === "fc-106")).toMatchObject(
      {
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: "landed",
      },
    );
  });

  it("casts all three event classes for every Scenario Seed", () => {
    const seeds = [
      "flow-first-shift",
      ...Array.from({ length: 20 }, (_, index) => `phase-5-seed-${index}`),
    ];
    for (const seed of seeds) {
      const scenario = generateScenario(seed);
      const replayedScenario = generateScenario(seed);
      expect(replayedScenario.eventDeck).toEqual(scenario.eventDeck);

      const rosterIds = scenario.aircraft.map(({ id }) => id);
      const intentionOf = (aircraftId: string) =>
        scenario.aircraft.find(({ id }) => id === aircraftId)?.intention;
      expect(scenario.aircraft.length).toBeGreaterThanOrEqual(6);
      expect(
        scenario.aircraft.filter(({ intention }) => intention === "circuit")
          .length,
      ).toBeGreaterThanOrEqual(1);

      const deck = scenario.eventDeck;
      expect(rosterIds).toContain(deck.emergency.aircraftId);
      expect(intentionOf(deck.emergency.aircraftId)).toBe("arrival");
      expect(rosterIds).toContain(deck.rejectedTakeoff.aircraftId);
      expect(intentionOf(deck.rejectedTakeoff.aircraftId)).toBe("departure");
      expect(rosterIds).toContain(deck.independentGoAround.aircraftId);
      expect(intentionOf(deck.independentGoAround.aircraftId)).toBe("arrival");
      expect(deck.independentGoAround.aircraftId).not.toBe(
        deck.emergency.aircraftId,
      );
      expect(intentionOf(deck.temporaryLimitation.aircraftId)).toBe("arrival");
      expect(deck.temporaryLimitation.aircraftId).not.toBe(
        deck.emergency.aircraftId,
      );
      expect(deck.temporaryLimitation.aircraftId).not.toBe(
        deck.independentGoAround.aircraftId,
      );
      expect(deck.emergency.status).toBe("pending");
      expect(deck.rejectedTakeoff.status).toBe("pending");
      expect(deck.independentGoAround.status).toBe("pending");
      expect(deck.temporaryLimitation.status).toBe("pending");
    }
  });

  it("executes the seeded independent go-around despite a landing Clearance and lands after replanning", () => {
    const scenarioSeed = "phase-5-independent-goaround";
    const scenario = generateScenario(scenarioSeed);
    const aircraftId = scenario.eventDeck.independentGoAround.aircraftId;
    const progress = scenario.aircraftProgress[aircraftId];
    const application = createFlowControlApplication({
      scenarioSeed,
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    issueManualRunwayClearance(application, aircraftId, {
      kind: "clear-to-land",
      runwayId: progress.runwayId,
      runwayEnd: progress.runwayEnd,
    });
    advanceUntil(
      application,
      () =>
        (
          application.query({ type: "operational-receipts" }) as Array<{
            action: string;
            summary?: string;
          }>
        ).some(
          (receipt) =>
            receipt.action === "pilot-go-around-executed" &&
            receipt.summary?.includes("unstable approach"),
        ),
      10_000,
    );
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot).aircraft.find(
        ({ id }) => id === aircraftId,
      )?.flightPhase,
    ).toBe("approach");

    issueManualRunwayClearance(application, aircraftId, {
      kind: "clear-to-land",
      runwayId: progress.runwayId,
      runwayEnd: progress.runwayEnd,
    });
    const landedSnapshot = advanceUntil(
      application,
      (snapshot) =>
        snapshot.aircraft.find(({ id }) => id === aircraftId)?.flightPhase ===
        "out-of-play",
      10_000,
    );
    expect(
      landedSnapshot.aircraft.find(({ id }) => id === aircraftId),
    ).toMatchObject({ exit: "landed" });
  });

  it("declares the seeded emergency and upgrades classification for protection and recovery", () => {
    const scenarioSeed = "phase-5-emergency";
    const scenario = generateScenario(scenarioSeed);
    const emergencyId = scenario.eventDeck.emergency.aircraftId;
    const emergencyProgress = scenario.aircraftProgress[emergencyId];
    const application = createFlowControlApplication({
      scenarioSeed,
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    advanceUntil(
      application,
      () =>
        (
          application.query({ type: "operational-receipts" }) as Array<{
            action: string;
          }>
        ).some((receipt) => receipt.action === "emergency-declared"),
      2_000,
    );
    expect(
      (
        application.query({ type: "transmissions" }) as Array<{
          speaker: string;
          text: string;
        }>
      ).some(
        ({ speaker, text }) =>
          speaker === "pilot" && text.startsWith("MAYDAY"),
      ),
    ).toBe(true);

    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    expect(
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: snapshot.stateVersion,
        runwayClearances: [
          {
            aircraftId: emergencyId,
            clearance: {
              kind: "clear-to-land",
              runwayId: emergencyProgress.runwayId,
              runwayEnd: emergencyProgress.runwayEnd,
            },
          },
        ],
      }),
    ).toMatchObject({ classification: "elevated" });
    expect(
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: snapshot.stateVersion,
        runwayClearances: [
          {
            aircraftId: emergencyId,
            clearance: {
              kind: "clear-to-land",
              runwayId: emergencyProgress.runwayId,
              runwayEnd: emergencyProgress.runwayEnd,
            },
          },
          {
            aircraftId: "fc-101",
            clearance: {
              kind: "hold-short",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          },
        ],
      }),
    ).toMatchObject({ classification: "exceptional-recovery" });
  });

  it("forces an arrival around when an occupied intersecting runway blocks its landing", () => {
    const scenarioSeed = "phase-5-blocked-landing";
    const scenario = generateScenario(scenarioSeed);
    const targetId = ["fc-202", "fc-303", "fc-505"].find(
      (id) =>
        id !== scenario.eventDeck.independentGoAround.aircraftId &&
        id !== scenario.eventDeck.emergency.aircraftId,
    ) as string;
    const targetProgress = scenario.aircraftProgress[targetId];
    const threshold = RUNWAY_END_THRESHOLDS[targetProgress.runwayEnd];
    const application = createFlowControlApplication({
      scenarioSeed,
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    issueManualRunwayClearance(application, targetId, {
      kind: "clear-to-land",
      runwayId: targetProgress.runwayId,
      runwayEnd: targetProgress.runwayEnd,
    });
    advanceUntil(
      application,
      (snapshot) => {
        const target = snapshot.aircraft.find(({ id }) => id === targetId);
        return (
          !!target &&
          Math.hypot(
            target.position.eastNauticalMiles - threshold.east,
            target.position.northNauticalMiles - threshold.north,
          ) < 1.7
        );
      },
      10_000,
    );
    issueManualRunwayClearance(application, "fc-101", {
      kind: "clear-for-takeoff",
      runwayId: "09-27",
      runwayEnd: "09",
    });

    advanceUntil(
      application,
      () =>
        (
          application.query({ type: "operational-receipts" }) as Array<{
            action: string;
            summary?: string;
          }>
        ).some(
          (receipt) =>
            receipt.action === "pilot-go-around-executed" &&
            receipt.summary?.includes("runway occupied"),
        ),
      500,
    );
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot).aircraft.find(
        ({ id }) => id === targetId,
      )?.flightPhase,
    ).toBe("approach");
  });

  it("does not arm the rejected takeoff before the emergency resolves", () => {
    const scenarioSeed = "phase-5-no-early-rejection";
    const scenario = generateScenario(scenarioSeed);
    const castId = scenario.eventDeck.rejectedTakeoff.aircraftId;
    const castProgress = scenario.aircraftProgress[castId];
    const application = createFlowControlApplication({
      scenarioSeed,
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    issueManualRunwayClearance(application, castId, {
      kind: "clear-for-takeoff",
      runwayId: castProgress.runwayId,
      runwayEnd: castProgress.runwayEnd === "09" ? "09" : castProgress.runwayEnd,
    });
    advanceUntil(
      application,
      (snapshot) =>
        snapshot.aircraft.find(({ id }) => id === castId)?.flightPhase ===
        "out-of-play",
      4_000,
    );
    expect(
      (
        application.query({ type: "operational-receipts" }) as Array<{
          action: string;
        }>
      ).some((receipt) => receipt.action === "takeoff-rejected"),
    ).toBe(false);
  });

  it("rejects the armed takeoff after approved recovery, holds the runway, and departs after replanning", () => {
    const scenarioSeed = "phase-5-rejected-takeoff";
    const scenario = generateScenario(scenarioSeed);
    const emergencyId = scenario.eventDeck.emergency.aircraftId;
    const emergencyProgress = scenario.aircraftProgress[emergencyId];
    const castId = scenario.eventDeck.rejectedTakeoff.aircraftId;
    const castProgress = scenario.aircraftProgress[castId];
    const application = createFlowControlApplication({
      scenarioSeed,
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    advanceUntil(
      application,
      () =>
        (
          application.query({ type: "operational-receipts" }) as Array<{
            action: string;
          }>
        ).some((receipt) => receipt.action === "emergency-declared"),
      2_000,
    );

    let snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    expect(
      application.command({
        type: "stage-recovery-plan",
        actor: "tower-agent",
        planReference: "emergency-recovery",
        runwayClearances: [
          {
            aircraftId: emergencyId,
            clearance: {
              kind: "clear-to-land",
              runwayId: emergencyProgress.runwayId,
              runwayEnd: emergencyProgress.runwayEnd,
            },
          },
          {
            aircraftId: castId,
            clearance: {
              kind: "hold-short",
              runwayId: castProgress.runwayId,
              runwayEnd: castProgress.runwayEnd,
            },
          },
        ],
        expectedStateVersion: snapshot.stateVersion,
      }),
    ).toMatchObject({ status: "approval-required" });
    snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    expect(
      application.command({
        type: "approve-recovery-plan",
        actor: "supervising-controller",
        expectedStateVersion: snapshot.stateVersion,
      }),
    ).toMatchObject({ status: "success" });

    advanceUntil(
      application,
      (currentSnapshot) =>
        currentSnapshot.aircraft.find(({ id }) => id === emergencyId)
          ?.flightPhase === "out-of-play",
      10_000,
    );

    issueManualRunwayClearance(application, castId, {
      kind: "clear-for-takeoff",
      runwayId: castProgress.runwayId,
      runwayEnd: castProgress.runwayEnd,
    });
    const rejectionSnapshot = advanceUntil(
      application,
      () =>
        (
          application.query({ type: "operational-receipts" }) as Array<{
            action: string;
          }>
        ).some((receipt) => receipt.action === "takeoff-rejected"),
      1_000,
    );
    const occupancy = rejectionSnapshot.runwayResources.runwayOccupancy.find(
      ({ aircraftId }) => aircraftId === castId,
    );
    expect(occupancy).toBeDefined();
    expect(
      (occupancy?.clearsAtSimulationTimeMs ?? 0) -
        rejectionSnapshot.simulationTimeMs,
    ).toBeGreaterThan(60_000);

    advanceUntil(
      application,
      (currentSnapshot) =>
        currentSnapshot.aircraft.find(({ id }) => id === castId)?.flightPhase ===
        "hold-short",
      1_500,
    );

    expect(
      application.command({
        type: "issue-runway-clearance",
        actor: "tower-agent",
        aircraftId: castId,
        clearance: {
          kind: "clear-for-takeoff",
          runwayId: castProgress.runwayId,
          runwayEnd: castProgress.runwayEnd,
        },
        expectedStateVersion: (
          application.query({ type: "tower-snapshot" }) as TowerSnapshot
        ).stateVersion,
      }),
    ).toMatchObject({
      status: "approval-required",
      nextAction: "stage_recovery_plan",
    });

    issueManualRunwayClearance(application, castId, {
      kind: "clear-for-takeoff",
      runwayId: castProgress.runwayId,
      runwayEnd: castProgress.runwayEnd,
    });
    const departedSnapshot = advanceUntil(
      application,
      (currentSnapshot) =>
        currentSnapshot.aircraft.find(({ id }) => id === castId)?.flightPhase ===
        "out-of-play",
      6_000,
    );
    expect(
      departedSnapshot.aircraft.find(({ id }) => id === castId),
    ).toMatchObject({ exit: "departed" });
  });

  it("never fires the rejected takeoff without an aligned arrival and refuses to complete the Shift", () => {
    const scenarioSeed = "phase-5-unaligned-rejection";
    const scenario = generateScenario(scenarioSeed);
    const deck = scenario.eventDeck;
    const application = createFlowControlApplication({
      scenarioSeed,
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    // Land every arrival first (handling unable and independent go-around
    // replanning) while approving the emergency Recovery Plan, so no arrival
    // remains airborne when the departures finally roll.
    for (let iteration = 0; iteration < 800; iteration += 1) {
      const snapshot = application.query({
        type: "tower-snapshot",
      }) as TowerSnapshot;
      const receipts = application.query({
        type: "operational-receipts",
      }) as Array<{ action: string; simulationTimeMs: number }>;
      const arrivalsRemaining = snapshot.aircraft.some((aircraft) => {
        const progress = scenario.aircraftProgress[aircraft.id];
        return (
          progress?.role === "arrival" && aircraft.flightPhase !== "out-of-play"
        );
      });
      if (!arrivalsRemaining) {
        break;
      }
      const emergencyDeclared = receipts.some(
        ({ action }) => action === "emergency-declared",
      );
      const recoveryApproved = receipts.some(
        ({ action }) => action === "recovery-plan-approved-and-dispatched",
      );
      if (emergencyDeclared && !recoveryApproved) {
        if (snapshot.stagedRecoveryPlan) {
          application.command({
            type: "approve-recovery-plan",
            actor: "supervising-controller",
            expectedStateVersion: snapshot.stateVersion,
          });
        } else {
          application.command({
            type: "stage-recovery-plan",
            actor: "tower-agent",
            planReference: "unaligned-emergency-recovery",
            runwayClearances: [
              {
                aircraftId: deck.emergency.aircraftId,
                clearance: {
                  kind: "clear-to-land",
                  runwayId:
                    scenario.aircraftProgress[deck.emergency.aircraftId]
                      .runwayId,
                  runwayEnd:
                    scenario.aircraftProgress[deck.emergency.aircraftId]
                      .runwayEnd,
                },
              },
              {
                aircraftId: deck.rejectedTakeoff.aircraftId,
                clearance: {
                  kind: "hold-short",
                  runwayId:
                    scenario.aircraftProgress[deck.rejectedTakeoff.aircraftId]
                      .runwayId,
                  runwayEnd:
                    scenario.aircraftProgress[deck.rejectedTakeoff.aircraftId]
                      .runwayEnd,
                },
              },
            ],
            expectedStateVersion: snapshot.stateVersion,
          });
        }
      }
      for (const aircraft of snapshot.aircraft) {
        const progress = scenario.aircraftProgress[aircraft.id];
        if (
          progress?.role !== "arrival" ||
          aircraft.flightPhase === "out-of-play" ||
          aircraft.activeRunwayClearance
        ) {
          continue;
        }
        if (
          aircraft.id === deck.emergency.aircraftId &&
          emergencyDeclared &&
          !recoveryApproved
        ) {
          continue;
        }
        issueManualRunwayClearance(application, aircraft.id, {
          kind: "clear-to-land",
          runwayId: progress.runwayId,
          runwayEnd: progress.runwayEnd,
        });
      }
      advanceSteps(application, 10);
    }

    // With no arrivals airborne, both departures lift off unrejected.
    for (const departureId of ["fc-101", "fc-404"]) {
      issueManualRunwayClearance(application, departureId, {
        kind: "clear-for-takeoff",
        runwayId: scenario.aircraftProgress[departureId].runwayId,
        runwayEnd: scenario.aircraftProgress[departureId].runwayEnd,
      });
      advanceUntil(
        application,
        (snapshot) =>
          snapshot.aircraft.find(({ id }) => id === departureId)?.flightPhase ===
          "out-of-play",
        4_000,
      );
    }
    advanceSteps(application, 600);

    const receipts = application.query({
      type: "operational-receipts",
    }) as Array<{ action: string }>;
    expect(
      receipts.some(({ action }) => action === "takeoff-rejected"),
    ).toBe(false);
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
        .shiftStatus,
    ).toBe("active");
  });

  it("reports an authored unable limitation and treats it as a replanning event", () => {
    const scenarioSeed = "phase-5-unable-limitation";
    const scenario = generateScenario(scenarioSeed);
    const limitedId = scenario.eventDeck.temporaryLimitation.aircraftId;
    const application = createFlowControlApplication({
      scenarioSeed,
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    advanceUntil(
      application,
      () =>
        (
          application.query({ type: "operational-receipts" }) as Array<{
            action: string;
          }>
        ).some((receipt) => receipt.action === "emergency-declared"),
      2_000,
    );

    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    application.command({
      type: "issue-tactical-instruction",
      actor: "supervising-controller",
      aircraftId: limitedId,
      instruction: { speedKnots: 80 },
      expectedStateVersion: snapshot.stateVersion,
    });
    advanceUntil(
      application,
      () =>
        (
          application.query({ type: "operational-receipts" }) as Array<{
            action: string;
          }>
        ).some((receipt) => receipt.action === "pilot-unable-reported"),
      100,
    );
    const limitedAircraft = (
      application.query({ type: "tower-snapshot" }) as TowerSnapshot
    ).aircraft.find(({ id }) => id === limitedId);
    expect(limitedAircraft?.activeTacticalInstruction).toBeUndefined();
    expect(
      (
        application.query({ type: "transmissions" }) as Array<{
          speaker: string;
          text: string;
        }>
      ).some(
        ({ speaker, text }) => speaker === "pilot" && text.includes("unable"),
      ),
    ).toBe(true);
  });

  it("completes the polished first-launch Shift with every coordination beat at the application boundary", () => {
    const scenario = generateScenario(FIRST_LAUNCH_SCENARIO_SEED);
    const deck = scenario.eventDeck;
    const progressOf = (aircraftId: string) =>
      scenario.aircraftProgress[aircraftId];
    const application = createFlowControlApplication({
      scenarioSeed: FIRST_LAUNCH_SCENARIO_SEED,
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const currentSnapshot = () =>
      application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const receiptsSoFar = () =>
      application.query({ type: "operational-receipts" }) as Array<{
        action: string;
        summary?: string;
        simulationTimeMs: number;
      }>;
    const hasReceipt = (action: string) =>
      receiptsSoFar().some((receipt) => receipt.action === action);
    const issueAsTowerAgent = (
      aircraftId: string,
      clearance: {
        kind: "clear-for-takeoff" | "clear-to-land" | "hold-short";
        runwayId: "09-27" | "04-22";
        runwayEnd: "09" | "27" | "04" | "22";
      },
    ) =>
      application.command({
        type: "issue-runway-clearance",
        actor: "tower-agent",
        aircraftId,
        clearance,
        expectedStateVersion: currentSnapshot().stateVersion,
      });

    let modificationDone = false;

    for (let iteration = 0; iteration < 900; iteration += 1) {
      const snapshot = currentSnapshot();
      if (snapshot.shiftStatus === "completed") {
        break;
      }

      // Controller-modification beat: stage, edit, and dispatch one Clearance
      // Plan atomically before the first disruption.
      if (!modificationDone) {
        const staging = application.command({
          type: "stage-clearance-plan",
          actor: "tower-agent",
          planReference: "opening-flow",
          runwayClearances: [
            {
              aircraftId: deck.rejectedTakeoff.aircraftId,
              clearance: {
                kind: "hold-short",
                runwayId: progressOf(deck.rejectedTakeoff.aircraftId).runwayId,
                runwayEnd: progressOf(deck.rejectedTakeoff.aircraftId)
                  .runwayEnd,
              },
            },
          ],
          tacticalInstructions: [
            {
              aircraftId: deck.emergency.aircraftId,
              instruction: { headingDegrees: 180 },
            },
          ],
          expectedStateVersion: snapshot.stateVersion,
        }) as { status: string };
        if (staging.status === "success" || staging.status === "approval-required") {
          const staged = currentSnapshot();
          const memberId = staged.stagedClearancePlan?.tacticalMembers[0]?.id;
          if (memberId) {
            application.command({
              type: "edit-clearance-plan-tactical-instruction",
              actor: "supervising-controller",
              memberId,
              changes: { headingDegrees: 200 },
              expectedStateVersion: staged.stateVersion,
            });
            application.command({
              type: "dispatch-selected-clearance-plan",
              actor: "supervising-controller",
              expectedStateVersion: currentSnapshot().stateVersion,
            });
            modificationDone = true;
          }
        }
      }

      const emergencyDeclared = hasReceipt("emergency-declared");
      const recoveryApproved = hasReceipt(
        "recovery-plan-approved-and-dispatched",
      );
      const emergencyAircraft = snapshot.aircraft.find(
        ({ id }) => id === deck.emergency.aircraftId,
      );
      const emergencyResolved = emergencyAircraft?.flightPhase === "out-of-play";

      // Exceptional-approval beat: protect first, then stage the Recovery
      // Plan and let the Supervising Controller approve it.
      if (emergencyDeclared && !recoveryApproved && !emergencyResolved) {
        if (currentSnapshot().stagedRecoveryPlan) {
          application.command({
            type: "approve-recovery-plan",
            actor: "supervising-controller",
            expectedStateVersion: currentSnapshot().stateVersion,
          });
        } else {
          application.command({
            type: "stage-recovery-plan",
            actor: "tower-agent",
            planReference: "emergency-recovery",
            runwayClearances: [
              {
                aircraftId: deck.emergency.aircraftId,
                clearance: {
                  kind: "clear-to-land",
                  runwayId: progressOf(deck.emergency.aircraftId).runwayId,
                  runwayEnd: progressOf(deck.emergency.aircraftId).runwayEnd,
                },
              },
              {
                aircraftId: deck.rejectedTakeoff.aircraftId,
                clearance: {
                  kind: "hold-short",
                  runwayId: progressOf(deck.rejectedTakeoff.aircraftId)
                    .runwayId,
                  runwayEnd: progressOf(deck.rejectedTakeoff.aircraftId)
                    .runwayEnd,
                },
              },
            ],
            expectedStateVersion: currentSnapshot().stateVersion,
          });
        }
      }

      // Rejected-takeoff recovery: identify the rejected aircraft from its
      // receipt, then stage and approve the Exceptional Recovery that
      // re-clears it alongside a disrupted arrival.
      const rejectionReceipt = receiptsSoFar().find(
        (receipt) => receipt.action === "takeoff-rejected",
      );
      const rejectedAircraftId = rejectionReceipt
        ? snapshot.aircraft.find(({ callsign }) =>
            rejectionReceipt.summary?.startsWith(callsign),
          )?.id
        : undefined;
      const rejectionRecoveryApproved =
        !!rejectionReceipt &&
        receiptsSoFar().some(
          (receipt) =>
            receipt.action === "recovery-plan-approved-and-dispatched" &&
            receipt.simulationTimeMs >= rejectionReceipt.simulationTimeMs,
        );
      if (rejectionReceipt && rejectedAircraftId && !rejectionRecoveryApproved) {
        const rejectedAircraft = snapshot.aircraft.find(
          ({ id }) => id === rejectedAircraftId,
        );
        if (
          rejectedAircraft?.flightPhase === "hold-short" &&
          !rejectedAircraft.activeRunwayClearance
        ) {
          if (currentSnapshot().stagedRecoveryPlan) {
            application.command({
              type: "approve-recovery-plan",
              actor: "supervising-controller",
              expectedStateVersion: currentSnapshot().stateVersion,
            });
          } else {
            const disruptedArrival = snapshot.aircraft.find((aircraft) => {
              const progress = progressOf(aircraft.id);
              return (
                progress?.role === "arrival" &&
                aircraft.flightPhase !== "out-of-play"
              );
            });
            if (disruptedArrival) {
              application.command({
                type: "stage-recovery-plan",
                actor: "tower-agent",
                planReference: "rejected-takeoff-recovery",
                runwayClearances: [
                  {
                    aircraftId: rejectedAircraftId,
                    clearance: {
                      kind: "clear-for-takeoff",
                      runwayId: progressOf(rejectedAircraftId).runwayId,
                      runwayEnd: progressOf(rejectedAircraftId).runwayEnd,
                    },
                  },
                  {
                    aircraftId: disruptedArrival.id,
                    clearance: {
                      kind: "clear-to-land",
                      runwayId: progressOf(disruptedArrival.id).runwayId,
                      runwayEnd: progressOf(disruptedArrival.id).runwayEnd,
                    },
                  },
                ],
                expectedStateVersion: currentSnapshot().stateVersion,
              });
            }
          }
        }
      }

      // Routine autonomy: keep departures and arrivals flowing.
      const arrivalAligned = snapshot.aircraft.some((aircraft) => {
        const progress = progressOf(aircraft.id);
        if (
          progress?.role !== "arrival" ||
          aircraft.flightPhase === "out-of-play" ||
          (aircraft.flightPhase !== "inbound" &&
            aircraft.flightPhase !== "approach")
        ) {
          return false;
        }
        const threshold = RUNWAY_END_THRESHOLDS[progress.runwayEnd];
        return (
          Math.hypot(
            aircraft.position.eastNauticalMiles - threshold.east,
            aircraft.position.northNauticalMiles - threshold.north,
          ) < 3
        );
      });
      for (const aircraft of snapshot.aircraft) {
        const progress = progressOf(aircraft.id);
        if (
          !progress ||
          aircraft.flightPhase === "out-of-play" ||
          (aircraft.activeRunwayClearance &&
            aircraft.activeRunwayClearance.kind !== "hold-short")
        ) {
          continue;
        }
        if (
          progress.role === "departure" &&
          aircraft.flightPhase === "hold-short"
        ) {
          const isRejectionCast = aircraft.id === deck.rejectedTakeoff.aircraftId;
          if (aircraft.id === rejectedAircraftId && !rejectionRecoveryApproved) {
            continue;
          }
          if (
            !isRejectionCast ||
            (recoveryApproved && emergencyResolved && arrivalAligned)
          ) {
            issueAsTowerAgent(aircraft.id, {
              kind: "clear-for-takeoff",
              runwayId: progress.runwayId,
              runwayEnd: progress.runwayEnd,
            });
          }
          continue;
        }
        if (
          progress.role === "arrival" &&
          (aircraft.flightPhase === "inbound" ||
            aircraft.flightPhase === "approach")
        ) {
          const isEmergency = aircraft.id === deck.emergency.aircraftId;
          if (!isEmergency || recoveryApproved) {
            issueAsTowerAgent(aircraft.id, {
              kind: "clear-to-land",
              runwayId: progress.runwayId,
              runwayEnd: progress.runwayEnd,
            });
          }
        }
      }

      advanceSteps(application, 10);
    }

    const finalSnapshot = currentSnapshot();
    expect(finalSnapshot.shiftStatus).toBe("completed");
    expect(finalSnapshot.simulationTimeMs).toBeLessThanOrEqual(660_000);
    const actions = receiptsSoFar().map(({ action }) => action);
    for (const requiredAction of [
      "runway-clearance-issued",
      "emergency-declared",
      "recovery-plan-approved-and-dispatched",
      "takeoff-rejected",
      "pilot-go-around-executed",
      "pilot-unable-reported",
      "clearance-plan-tactical-instruction-edited",
      "clearance-plan-dispatched",
      "stable-flow-restored",
      "shift-completed",
    ]) {
      expect(actions).toContain(requiredAction);
    }
    expect(
      receiptsSoFar().some(
        (receipt) =>
          receipt.action === "pilot-go-around-executed" &&
          receipt.summary?.includes("unstable approach"),
      ),
    ).toBe(true);

    // The rejected-takeoff recovery crossed the approval boundary after the
    // rejection rather than resolving through a routine re-clearance.
    const rejectionAt = receiptsSoFar().find(
      ({ action }) => action === "takeoff-rejected",
    )?.simulationTimeMs;
    expect(
      receiptsSoFar().filter(
        (receipt) =>
          receipt.action === "recovery-plan-approved-and-dispatched" &&
          receipt.simulationTimeMs >= (rejectionAt ?? Number.POSITIVE_INFINITY),
      ).length,
    ).toBeGreaterThanOrEqual(1);

    // A completed Shift is read-only at both boundaries: capability
    // discovery collapses to the read surface and cached mutations refuse.
    const readOnlyCapabilities = [
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
    ];
    expect(application.query({ type: "available-capabilities" })).toEqual(
      readOnlyCapabilities,
    );
    expect(application.query({ type: "capabilities-to-register" })).toEqual(
      readOnlyCapabilities,
    );
    const cachedMutation = application.command({
      type: "issue-runway-clearance",
      actor: "tower-agent",
      aircraftId: "fc-106",
      clearance: { kind: "clear-to-land", runwayId: "09-27", runwayEnd: "09" },
      expectedStateVersion: finalSnapshot.stateVersion,
    });
    expect(cachedMutation).toMatchObject({
      status: "refusal",
      summary: "The Shift is complete; operational state is read-only.",
    });
    expect(
      application.command({
        type: "approve-recovery-plan",
        actor: "supervising-controller",
        expectedStateVersion: finalSnapshot.stateVersion,
      }),
    ).toMatchObject({ status: "refusal" });
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
        .stateVersion,
    ).toBe(finalSnapshot.stateVersion);
  });

  it("clears the Supervising Controller's aircraft selection without touching the State Version", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-5-clear-selection",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "select-aircraft",
      actor: "supervising-controller",
      aircraftId: "fc-202",
    });
    expect(application.query({ type: "selected-context" })).toMatchObject({
      selectionStatus: "selected",
      selectedAircraftId: "fc-202",
    });

    expect(
      application.command({
        type: "clear-aircraft-selection",
        actor: "supervising-controller",
      }),
    ).toMatchObject({ status: "success", stateVersion: 1 });
    expect(application.query({ type: "selected-context" })).toMatchObject({
      selectionStatus: "none",
    });
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
        .selectedAircraftId,
    ).toBeUndefined();
  });

  it("replays clearance-gated traffic deterministically from the same Scenario Seed", () => {
    const runShift = () => {
      const application = createFlowControlApplication({
        scenarioSeed: "phase-5-causal-replay",
        operatingPosture: "observe",
      });
      application.command({
        type: "begin-shift",
        actor: "tower-agent",
        expectedStateVersion: 0,
      });
      advanceSteps(application, 50);
      issueManualRunwayClearance(application, "fc-101", {
        kind: "clear-for-takeoff",
        runwayId: "09-27",
        runwayEnd: "09",
      });
      advanceSteps(application, 400);
      issueManualRunwayClearance(application, "fc-202", {
        kind: "clear-to-land",
        runwayId: "04-22",
        runwayEnd: "04",
      });
      advanceSteps(application, 2_600);
      return {
        snapshot: application.query({ type: "tower-snapshot" }),
        receipts: application.query({ type: "operational-receipts" }),
        transmissions: application.query({ type: "transmissions" }),
      };
    };

    expect(runShift()).toEqual(runShift());
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

    issueManualRunwayClearance(application, "fc-101", {
      kind: "clear-for-takeoff",
      runwayId: "09-27",
      runwayEnd: "09",
    });
    const rollingSnapshot = advanceUntil(
      application,
      (snapshot) => snapshot.runwayResources.runwayOccupancy.length > 0,
      500,
    );
    expect(rollingSnapshot.runwayResources).toEqual({
      runwayOccupancy: [
        {
          runwayId: "09-27",
          aircraftId: "fc-101",
          callsign: "FLOW 101",
          operation: "departure",
          clearsAtSimulationTimeMs: expect.any(Number),
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
    const clearsAtSimulationTimeMs =
      rollingSnapshot.runwayResources.runwayOccupancy[0]
        .clearsAtSimulationTimeMs;
    expect(clearsAtSimulationTimeMs).toBeGreaterThan(
      rollingSnapshot.simulationTimeMs,
    );

    const clearedSnapshot = advanceUntil(
      application,
      (snapshot) => snapshot.runwayResources.runwayOccupancy.length === 0,
      500,
    );
    expect(clearedSnapshot.runwayResources).toEqual({
      runwayOccupancy: [],
      intersectionOccupancy: [],
    });
    expect(clearedSnapshot.simulationTimeMs).toBeGreaterThanOrEqual(
      clearsAtSimulationTimeMs,
    );
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
    issueManualRunwayClearance(application, "fc-101", {
      kind: "clear-for-takeoff",
      runwayId: "09-27",
      runwayEnd: "09",
    });
    const rollingSnapshot = advanceUntil(
      application,
      (snapshot) => snapshot.runwayResources.runwayOccupancy.length > 0,
      500,
    );
    const occupancyClearsAtSimulationTimeMs =
      rollingSnapshot.runwayResources.runwayOccupancy[0]
        .clearsAtSimulationTimeMs;

    const beforeEvaluation = {
      snapshot: application.query({ type: "tower-snapshot" }),
      receipts: application.query({ type: "operational-receipts" }),
    };

    expect(
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: rollingSnapshot.stateVersion,
        runwayClearances: [
          {
            aircraftId: "fc-404",
            clearance: {
              kind: "clear-for-takeoff",
              runwayId: "09-27",
              runwayEnd: "27",
            },
          },
        ],
      }),
    ).toEqual({
      status: "refusal",
      valid: false,
      evaluatedStateVersion: rollingSnapshot.stateVersion,
      simulationTimeMs: rollingSnapshot.simulationTimeMs,
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
      mustIssueBySimulationTimeMs: occupancyClearsAtSimulationTimeMs,
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

  it("predicts a runway-separation conflict between two issued Clearances demanding the same runway window", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-5-predicted-demand",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    issueManualRunwayClearance(application, "fc-101", {
      kind: "clear-for-takeoff",
      runwayId: "09-27",
      runwayEnd: "09",
    });
    issueManualRunwayClearance(application, "fc-404", {
      kind: "clear-for-takeoff",
      runwayId: "09-27",
      runwayEnd: "27",
    });

    const conflicts = application.query({ type: "active-conflicts" }) as {
      current: Array<Record<string, unknown>>;
      predicted: Array<Record<string, unknown>>;
    };
    expect(conflicts.current).toEqual([]);
    expect(conflicts.predicted).toEqual([
      expect.objectContaining({
        kind: "runway-separation",
        status: "predicted",
        resourceId: "09-27",
        aircraftIds: ["fc-101", "fc-404"],
      }),
    ]);
  });

  it("refuses a Clearance sequenced too soon behind the preceding runway occupant's wake", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-wake-separation",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    issueManualRunwayClearance(application, "fc-101", {
      kind: "clear-for-takeoff",
      runwayId: "09-27",
      runwayEnd: "09",
    });
    const rollingSnapshot = advanceUntil(
      application,
      (snapshot) => snapshot.runwayResources.runwayOccupancy.length > 0,
      500,
    );
    const releaseAtSimulationTimeMs =
      rollingSnapshot.runwayResources.runwayOccupancy[0]
        .clearsAtSimulationTimeMs;
    const evaluationSnapshot = advanceUntil(
      application,
      (snapshot) => snapshot.runwayResources.runwayOccupancy.length === 0,
      500,
    );

    expect(
      application.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: evaluationSnapshot.stateVersion,
        effectiveAtSimulationTimeMs: releaseAtSimulationTimeMs + 2_000,
        runwayClearances: [
          {
            aircraftId: "fc-404",
            clearance: {
              kind: "clear-for-takeoff",
              runwayId: "09-27",
              runwayEnd: "27",
            },
          },
        ],
      }),
    ).toMatchObject({
      status: "refusal",
      valid: false,
      classification: "routine",
      affectedAircraft: ["fc-101", "fc-404"],
      conflicts: [],
      constraints: [
        {
          kind: "wake-separation",
          resourceId: "09-27",
          leaderAircraftId: "fc-101",
          followerAircraftId: "fc-404",
          requiredSpacingMs: 5_000,
          availableSpacingMs: 2_000,
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

  it("stages an evaluated Clearance Plan with its State Version and Plan Expiry", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-clearance-plan",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.command({
        type: "stage-clearance-plan",
        actor: "tower-agent",
        planReference: "departure-101",
        runwayClearances: [
          {
            aircraftId: "fc-101",
            clearance: {
              kind: "clear-for-takeoff",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          },
        ],
        expectedStateVersion: 1,
      }),
    ).toMatchObject({ status: "success", stateVersion: 2 });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlan: {
        reference: "departure-101",
        runwayClearances: [
          {
            aircraftId: "fc-101",
            clearance: {
              kind: "clear-for-takeoff",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          },
        ],
        classification: "routine",
        evaluatedStateVersion: 1,
        expiresAtSimulationTimeMs: 30_000,
      },
    });
  });

  it("stages an Exceptional Recovery Plan for explicit human approval without dispatching it", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-recovery-plan",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.command({
        type: "stage-recovery-plan",
        actor: "tower-agent",
        planReference: "go-around-recovery",
        runwayClearances: [
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
        ],
        expectedStateVersion: 1,
      }),
    ).toEqual({
      status: "approval-required",
      stateVersion: 2,
      summary:
        "Recovery Plan go-around-recovery staged for explicit human approval.",
      nextAction: "review-recovery-plan",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedRecoveryPlan: {
        reference: "go-around-recovery",
        classification: "exceptional-recovery",
        evaluatedStateVersion: 1,
        expiresAtSimulationTimeMs: 30_000,
      },
      transmissions: [],
    });
  });

  it("revalidates and dispatches an approved Recovery Plan atomically", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-recovery-approval",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-recovery-plan",
      actor: "tower-agent",
      planReference: "go-around-recovery",
      runwayClearances: [
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
      ],
      expectedStateVersion: 1,
    });

    expect(
      application.command({
        type: "approve-recovery-plan",
        actor: "supervising-controller",
        expectedStateVersion: 2,
      }),
    ).toEqual({
      status: "success",
      stateVersion: 3,
      summary:
        "Recovery Plan go-around-recovery approved and dispatched 2 clearance members.",
      nextAction: "continue",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedRecoveryPlan: undefined,
      transmissions: [
        {
          speaker: "controller",
          aircraftId: "fc-202",
          text: "FLOW 202, go around runway 22.",
        },
        {
          speaker: "controller",
          aircraftId: "fc-404",
          text: "FLOW 404, hold short runway 09.",
        },
      ],
    });
  });

  it("expires a staged Clearance Plan at its deterministic Plan Expiry", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-plan-expiry",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "short-lived-departure",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "clear-for-takeoff",
            runwayId: "09-27",
            runwayEnd: "09",
          },
        },
      ],
      expectedStateVersion: 1,
    });

    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 300,
    });

    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlanReference: undefined,
      stagedClearancePlan: undefined,
    });
    expect(application.query({ type: "operational-receipts" })).toContainEqual(
      expect.objectContaining({
        actor: "simulation-clock",
        action: "clearance-plan-expired",
        simulationTimeMs: 30_000,
      }),
    );
  });

  it("invalidates a staged plan when a manual Tactical Instruction changes the Shift", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-material-plan-invalidation",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "departure-101",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "clear-for-takeoff",
            runwayId: "09-27",
            runwayEnd: "09",
          },
        },
      ],
      expectedStateVersion: 1,
    });

    expect(
      application.command({
        type: "issue-tactical-instruction",
        actor: "supervising-controller",
        aircraftId: "fc-202",
        instruction: { headingDegrees: 120 },
        expectedStateVersion: 2,
      }),
    ).toMatchObject({ status: "success", stateVersion: 4 });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlanReference: undefined,
      stagedClearancePlan: undefined,
    });
    expect(application.query({ type: "operational-receipts" })).toContainEqual(
      expect.objectContaining({
        action: "clearance-plan-invalidated",
        simulationTimeMs: 0,
        stateVersionBefore: 3,
        stateVersionAfter: 4,
      }),
    );
  });

  it("deselects one Clearance Plan member while retaining a revalidated safe subset", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-partial-selection",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "two-holds",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "hold-short",
            runwayId: "09-27",
            runwayEnd: "09",
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
      ],
      expectedStateVersion: 1,
    });

    expect(
      application.command({
        type: "set-clearance-plan-member-selection",
        actor: "supervising-controller",
        memberId: "two-holds:runway-clearance:2",
        selected: false,
        expectedStateVersion: 2,
      }),
    ).toEqual({
      status: "success",
      stateVersion: 3,
      summary:
        "Clearance Plan member two-holds:runway-clearance:2 is deselected; the selected subset remains valid.",
      nextAction: "await-plan-review",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlan: {
        members: [
          { id: "two-holds:runway-clearance:1", selected: true },
          { id: "two-holds:runway-clearance:2", selected: false },
        ],
      },
    });
  });

  it("dispatches only the selected safe Clearance Plan subset", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-partial-dispatch",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "two-holds",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "hold-short",
            runwayId: "09-27",
            runwayEnd: "09",
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
      ],
      expectedStateVersion: 1,
    });
    application.command({
      type: "set-clearance-plan-member-selection",
      actor: "supervising-controller",
      memberId: "two-holds:runway-clearance:2",
      selected: false,
      expectedStateVersion: 2,
    });

    expect(
      application.command({
        type: "dispatch-selected-clearance-plan",
        actor: "supervising-controller",
        expectedStateVersion: 3,
      }),
    ).toEqual({
      status: "success",
      stateVersion: 4,
      summary:
        "Clearance Plan two-holds dispatched 1 selected clearance member.",
      nextAction: "continue",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlanReference: undefined,
      stagedClearancePlan: undefined,
      transmissions: [
        {
          speaker: "controller",
          aircraftId: "fc-101",
          text: "FLOW 101, hold short runway 09.",
        },
      ],
    });
    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot).aircraft.find(
        ({ id }) => id === "fc-404",
      ),
    ).not.toHaveProperty("activeRunwayClearance");
  });

  it("replaces a Clearance Plan member with an agent-provided alternative after revalidation", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-plan-alternative",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "departure-option",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "hold-short",
            runwayId: "09-27",
            runwayEnd: "09",
          },
          alternatives: [
            {
              kind: "line-up-and-wait",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          ],
        },
      ],
      expectedStateVersion: 1,
    });

    expect(
      application.command({
        type: "select-clearance-plan-alternative",
        actor: "supervising-controller",
        memberId: "departure-option:runway-clearance:1",
        alternativeId:
          "departure-option:runway-clearance:1:alternative:1",
        expectedStateVersion: 2,
      }),
    ).toEqual({
      status: "success",
      stateVersion: 3,
      summary:
        "Clearance Plan alternative departure-option:runway-clearance:1:alternative:1 selected; the selected subset remains valid.",
      nextAction: "await-plan-review",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlan: {
        members: [
          {
            id: "departure-option:runway-clearance:1",
            selected: true,
            clearance: {
              kind: "line-up-and-wait",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          },
        ],
      },
    });
  });

  it("edits a Clearance Plan Tactical Instruction and revalidates the selected remainder", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-2-plan-tactical-edit",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "arrival-vector",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "hold-short",
            runwayId: "09-27",
            runwayEnd: "09",
          },
        },
      ],
      tacticalInstructions: [
        {
          aircraftId: "fc-202",
          instruction: {
            headingDegrees: 100,
            altitudeFeet: 3000,
            speedKnots: 170,
          },
        },
      ],
      expectedStateVersion: 1,
    });

    expect(
      application.command({
        type: "edit-clearance-plan-tactical-instruction",
        actor: "supervising-controller",
        memberId: "arrival-vector:tactical-instruction:1",
        changes: { headingDegrees: 120, altitudeFeet: 3500 },
        expectedStateVersion: 2,
      }),
    ).toEqual({
      status: "success",
      stateVersion: 3,
      summary:
        "Clearance Plan Tactical Instruction arrival-vector:tactical-instruction:1 edited; the selected subset remains valid.",
      nextAction: "await-plan-review",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlan: {
        tacticalMembers: [
          {
            id: "arrival-vector:tactical-instruction:1",
            aircraftId: "fc-202",
            selected: true,
            instruction: {
              headingDegrees: 120,
              altitudeFeet: 3500,
              speedKnots: 170,
            },
          },
        ],
      },
    });
  });

  it("passes the Phase 2 policy and planning gate at the application boundary", () => {
    const protectedOperations = createFlowControlApplication({
      scenarioSeed: "phase-2-gate-protection",
      operatingPosture: "take-the-sector",
    });
    protectedOperations.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      protectedOperations.command({
        type: "issue-runway-clearance",
        actor: "tower-agent",
        aircraftId: "fc-505",
        clearance: {
          kind: "clear-to-land",
          runwayId: "04-22",
          runwayEnd: "22",
        },
        expectedStateVersion: 1,
      }),
    ).toMatchObject({ status: "refusal", stateVersion: 1 });
    expect(protectedOperations.query({ type: "tower-snapshot" })).toMatchObject({
      transmissions: [],
    });
    expect(
      protectedOperations.query({
        type: "evaluate-clearance-set",
        expectedStateVersion: 1,
        runwayClearances: [
          {
            aircraftId: "fc-202",
            clearance: {
              kind: "go-around",
              runwayId: "04-22",
              runwayEnd: "22",
            },
          },
        ],
      }),
    ).toMatchObject({ valid: true, classification: "elevated" });
    expect(
      protectedOperations.command({
        type: "issue-runway-clearance",
        actor: "tower-agent",
        aircraftId: "fc-202",
        clearance: {
          kind: "go-around",
          runwayId: "04-22",
          runwayEnd: "22",
        },
        expectedStateVersion: 1,
      }),
    ).toMatchObject({ status: "success", stateVersion: 2 });

    const recovery = createFlowControlApplication({
      scenarioSeed: "phase-2-gate-recovery",
      operatingPosture: "assist",
    });
    recovery.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    expect(
      recovery.command({
        type: "stage-recovery-plan",
        actor: "tower-agent",
        planReference: "go-around-recovery",
        runwayClearances: [
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
        ],
        expectedStateVersion: 1,
      }),
    ).toMatchObject({ status: "approval-required", stateVersion: 2 });
    expect(recovery.query({ type: "tower-snapshot" })).toMatchObject({
      stagedRecoveryPlan: expect.objectContaining({
        reference: "go-around-recovery",
      }),
      transmissions: [],
    });
    expect(
      recovery.command({
        type: "approve-recovery-plan",
        actor: "supervising-controller",
        expectedStateVersion: 2,
      }),
    ).toMatchObject({ status: "success", stateVersion: 3 });

    const partialDispatch = createFlowControlApplication({
      scenarioSeed: "phase-2-gate-partial-dispatch",
      operatingPosture: "assist",
    });
    partialDispatch.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    partialDispatch.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "two-holds",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: { kind: "hold-short", runwayId: "09-27", runwayEnd: "09" },
        },
        {
          aircraftId: "fc-404",
          clearance: { kind: "hold-short", runwayId: "09-27", runwayEnd: "09" },
        },
      ],
      expectedStateVersion: 1,
    });
    partialDispatch.command({
      type: "set-clearance-plan-member-selection",
      actor: "supervising-controller",
      memberId: "two-holds:runway-clearance:2",
      selected: false,
      expectedStateVersion: 2,
    });
    expect(
      partialDispatch.command({
        type: "dispatch-selected-clearance-plan",
        actor: "supervising-controller",
        expectedStateVersion: 3,
      }),
    ).toMatchObject({ status: "success", stateVersion: 4 });
    expect(partialDispatch.query({ type: "tower-snapshot" })).toMatchObject({
      transmissions: [
        expect.objectContaining({ aircraftId: "fc-101" }),
      ],
    });
    expect(
      (partialDispatch.query({ type: "tower-snapshot" }) as TowerSnapshot).aircraft.find(
        ({ id }) => id === "fc-404",
      ),
    ).not.toHaveProperty("activeRunwayClearance");

    const replanning = createFlowControlApplication({
      scenarioSeed: "phase-2-gate-replanning",
      operatingPosture: "assist",
    });
    replanning.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    replanning.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "departure-101",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "clear-for-takeoff",
            runwayId: "09-27",
            runwayEnd: "09",
          },
        },
      ],
      expectedStateVersion: 1,
    });
    replanning.command({
      type: "issue-tactical-instruction",
      actor: "supervising-controller",
      aircraftId: "fc-202",
      instruction: { headingDegrees: 120 },
      expectedStateVersion: 2,
    });
    expect(replanning.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlan: undefined,
    });
    expect(
      replanning.command({
        type: "dispatch-selected-clearance-plan",
        actor: "supervising-controller",
        expectedStateVersion: 2,
      }),
    ).toMatchObject({
      status: "stale",
      stateVersion: 4,
      summary:
        "Clearance Plan dispatch refused because the expected State Version is stale.",
    });
    expect(
      replanning.command({
        type: "stage-clearance-plan",
        actor: "tower-agent",
        planReference: "recalculated-departure-101",
        runwayClearances: [
          {
            aircraftId: "fc-101",
            clearance: {
              kind: "clear-for-takeoff",
              runwayId: "09-27",
              runwayEnd: "09",
            },
          },
        ],
        expectedStateVersion: 4,
      }),
    ).toMatchObject({ status: "success", stateVersion: 5 });
    expect(replanning.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlan: {
        reference: "recalculated-departure-101",
        evaluatedStateVersion: 4,
      },
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

  it("connects a begin call while armed even when its State Version has drifted", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    // The Supervising Controller works live traffic while armed, so the State
    // Version has moved before the agent's kickoff prompt (expectedStateVersion
    // 0) is ever sent.
    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 50,
    });
    issueManualRunwayClearance(application, "fc-101", {
      kind: "hold-short",
      runwayId: "09-27",
      runwayEnd: "09",
    });
    const { stateVersion: driftedVersion } = application.query({
      type: "tower-snapshot",
    }) as { stateVersion: number };
    expect(driftedVersion).toBeGreaterThan(0);

    const result = application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: driftedVersion + 1,
      nextAction: "get_tower_snapshot",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      shiftStatus: "active",
      stateVersion: driftedVersion + 1,
    });
    expect(
      (application.query({ type: "operational-receipts" }) as unknown[]).at(-1),
    ).toMatchObject({
      action: "shift-began",
      stateVersionBefore: driftedVersion,
      stateVersionAfter: driftedVersion + 1,
    });
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

  it("runs traffic from arming so the sector is live before the Tower Agent connects", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      simulation: { fixedTimeStepMs: 100, paceMultiplier: 1 },
    });

    const advanced = application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 50,
    });

    expect(advanced).toMatchObject({ status: "success" });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      shiftStatus: "armed",
      simulationTimeMs: 5_000,
    });
    // Only the connection capability is offered until the agent begins.
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "begin_tower_shift",
    ]);

    const { stateVersion } = application.query({
      type: "tower-snapshot",
    }) as { stateVersion: number };
    const began = application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: stateVersion,
    });

    expect(began).toMatchObject({ status: "success" });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      shiftStatus: "active",
      simulationTimeMs: 5_000,
    });
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

  it("immediately reduces Take the Sector to Assist, withdrawing only dispatch capability", () => {
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
      operatingPosture: "assist",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 2,
      summary: "Operating Posture reduced to Assist.",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "assist",
      pendingOperatingPosture: undefined,
      capabilitySynchronization: undefined,
      stateVersion: 2,
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
      "stage_clearance_plan",
      "stage_recovery_plan",
    ]);
    expect(
      (application.query({ type: "operational-receipts" }) as unknown[]).at(-1),
    ).toMatchObject({
      actor: "supervising-controller",
      action: "operating-posture-reduced",
      stateVersionBefore: 1,
      stateVersionAfter: 2,
    });
  });

  it("immediately reduces Assist to Observe", () => {
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
    expect(application.query({ type: "available-capabilities" })).toHaveLength(5);
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      stateVersion: 2,
    });
  });

  it("refuses a reduction that would not lower the current posture", () => {
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
      type: "reduce-operating-posture",
      actor: "supervising-controller",
      operatingPosture: "assist",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "refusal",
      stateVersion: 1,
      summary: "Operating Posture reduction to Assist refused.",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      stateVersion: 1,
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(5);
  });

  it("requires explicit confirmation before Assist is delegated from Observe", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const requested = application.command({
      type: "request-operating-posture-increase",
      actor: "supervising-controller",
      operatingPosture: "assist",
      expectedStateVersion: 1,
    });

    expect(requested).toMatchObject({
      status: "approval-required",
      stateVersion: 2,
      summary: "Assist grant is pending human confirmation.",
      nextAction: "confirm-operating-posture-increase",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      pendingOperatingPosture: "assist",
      capabilitySynchronization: "awaiting-confirmation",
      stateVersion: 2,
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(5);

    const confirmed = application.command({
      type: "confirm-operating-posture-increase",
      actor: "supervising-controller",
      expectedStateVersion: 2,
    });

    expect(confirmed).toMatchObject({
      status: "success",
      stateVersion: 3,
      summary: "Assist grant confirmed; capability synchronization is pending.",
      nextAction: "synchronize-capabilities",
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(5);
    expect(application.query({ type: "capabilities-to-register" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
      "stage_clearance_plan",
      "stage_recovery_plan",
    ]);

    const synchronized = application.command({
      type: "complete-capability-synchronization",
      actor: "capability-registry",
      expectedStateVersion: 3,
    });

    expect(synchronized).toMatchObject({
      status: "success",
      stateVersion: 4,
      summary: "Assist capability synchronization completed.",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "assist",
      pendingOperatingPosture: undefined,
      capabilitySynchronization: undefined,
      stateVersion: 4,
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(7);
  });

  it("requires explicit confirmation before Assist is raised to Take the Sector", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const requested = application.command({
      type: "request-operating-posture-increase",
      actor: "supervising-controller",
      operatingPosture: "take-the-sector",
      expectedStateVersion: 1,
    });

    expect(requested).toMatchObject({
      status: "approval-required",
      stateVersion: 2,
      summary: "Take the Sector grant is pending human confirmation.",
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(7);
    expect(application.query({ type: "capabilities-to-register" })).toHaveLength(7);

    application.command({
      type: "confirm-operating-posture-increase",
      actor: "supervising-controller",
      expectedStateVersion: 2,
    });

    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "assist",
      pendingOperatingPosture: "take-the-sector",
      capabilitySynchronization: "pending",
      stateVersion: 3,
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(7);
    expect(application.query({ type: "capabilities-to-register" })).toHaveLength(9);

    application.command({
      type: "complete-capability-synchronization",
      actor: "capability-registry",
      expectedStateVersion: 3,
    });

    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "take-the-sector",
      stateVersion: 4,
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(9);
  });

  it("refuses an increase request that would not raise the current posture", () => {
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
      type: "request-operating-posture-increase",
      actor: "supervising-controller",
      operatingPosture: "assist",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "refusal",
      stateVersion: 1,
      summary: "Assist grant request refused.",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "take-the-sector",
      pendingOperatingPosture: undefined,
      capabilitySynchronization: undefined,
      stateVersion: 1,
    });
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

describe("Tactical Instruction compliance", () => {
  const ARRIVAL_ID = "fc-202";

  // Signed difference between two headings, so 360 and 0 compare equal.
  function headingError(actualDegrees: number, expectedDegrees: number) {
    return ((actualDegrees - expectedDegrees + 540) % 360) - 180;
  }

  function inboundArrival(scenarioSeed: string) {
    // The seeded "unable" limitation must not land on the aircraft under test.
    expect(
      generateScenario(scenarioSeed).eventDeck.temporaryLimitation.aircraftId,
    ).not.toBe(ARRIVAL_ID);
    const application = createFlowControlApplication({
      scenarioSeed,
      operatingPosture: "observe",
      simulation: { fixedTimeStepMs: 100, paceMultiplier: 1 },
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    // fc-202 enters play as an inbound arrival (its pilot switches from
    // awaiting contact to monitoring); wait for that, then a few seconds more
    // so it is clear of its entry point.
    advanceUntil(application, (snapshot) =>
      snapshot.aircraft.some(
        ({ id, pilotState }) => id === ARRIVAL_ID && pilotState === "monitoring",
      ),
    );
    advanceSteps(application, 20);
    const progress = generateScenario(scenarioSeed).aircraftProgress[ARRIVAL_ID];
    return { application, progress };
  }

  function arrival(application: FlowControlApplication) {
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const aircraft = snapshot.aircraft.find(({ id }) => id === ARRIVAL_ID);
    if (!aircraft) {
      throw new Error("fc-202 missing from the snapshot.");
    }
    return aircraft;
  }

  function issueInstruction(
    application: FlowControlApplication,
    instruction: { headingDegrees?: number; altitudeFeet?: number; speedKnots?: number },
  ) {
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    return application.command({
      type: "issue-tactical-instruction",
      actor: "supervising-controller",
      aircraftId: ARRIVAL_ID,
      instruction,
      expectedStateVersion: snapshot.stateVersion,
    });
  }

  function awaitReadback(application: FlowControlApplication) {
    advanceUntil(
      application,
      (snapshot) =>
        snapshot.aircraft.find(({ id }) => id === ARRIVAL_ID)?.pilotState ===
        "operating",
      600,
    );
  }

  it("flies a read-back heading as a vector off the approach, dropping any landing clearance", () => {
    const { application, progress } = inboundArrival("tactical-d");
    issueManualRunwayClearance(application, ARRIVAL_ID, {
      kind: "clear-to-land",
      runwayId: progress.runwayId,
      runwayEnd: progress.runwayEnd,
    });
    awaitReadback(application);
    expect(arrival(application).activeRunwayClearance?.kind).toBe("clear-to-land");
    const beforeVector = arrival(application);

    const result = issueInstruction(application, { headingDegrees: 360, altitudeFeet: 4_000 });
    expect(result).toMatchObject({ status: "success" });
    // Until the pilot reads back, the aircraft keeps flying its approach path.
    expect(arrival(application).pilotState).toBe("awaiting-readback");
    awaitReadback(application);
    advanceSteps(application, 100);

    const vectored = arrival(application);
    expect(headingError(vectored.headingDegrees, 360)).toBeCloseTo(0, 3);
    expect(headingError(vectored.trackDegrees, 360)).toBeCloseTo(0, 3);
    expect(vectored.position.northNauticalMiles).toBeGreaterThan(
      beforeVector.position.northNauticalMiles + 0.3,
    );
    expect(vectored.altitudeFeet).toBeGreaterThan(beforeVector.altitudeFeet);
    expect(vectored.altitudeFeet).toBeLessThanOrEqual(4_000);
    expect(vectored.flightPhase).toBe("inbound");
    expect(vectored.activeRunwayClearance).toBeUndefined();
    expect(vectored.activeTacticalInstruction).toEqual({
      headingDegrees: 360,
      altitudeFeet: 4_000,
    });
    // A vectored aircraft is no longer booked against the runway.
    const conflicts = application.query({ type: "active-conflicts" }) as {
      predicted: Array<{ aircraftIds: string[] }>;
    };
    expect(
      conflicts.predicted.some(({ aircraftIds }) => aircraftIds.includes(ARRIVAL_ID)),
    ).toBe(false);
  });

  it("re-establishes the approach and lands when a vectored arrival is cleared to land again", () => {
    const { application, progress } = inboundArrival("tactical-d");
    issueInstruction(application, { headingDegrees: 180 });
    awaitReadback(application);
    advanceSteps(application, 100);
    expect(headingError(arrival(application).trackDegrees, 180)).toBeCloseTo(0, 3);

    issueManualRunwayClearance(application, ARRIVAL_ID, {
      kind: "clear-to-land",
      runwayId: progress.runwayId,
      runwayEnd: progress.runwayEnd,
    });
    awaitReadback(application);
    advanceSteps(application, 10);

    const rejoining = arrival(application);
    expect(rejoining.activeTacticalInstruction).toBeUndefined();
    expect(rejoining.activeRunwayClearance?.kind).toBe("clear-to-land");
    expect(Math.abs(headingError(rejoining.trackDegrees, 180))).toBeGreaterThan(5);

    const landed = advanceUntil(
      application,
      (snapshot) =>
        snapshot.aircraft.find(({ id }) => id === ARRIVAL_ID)?.exit === "landed",
      20_000,
    ).aircraft.find(({ id }) => id === ARRIVAL_ID);
    expect(landed).toMatchObject({ flightPhase: "out-of-play", exit: "landed" });
  });

  it("hands off an arrival vectored out of the local control boundary", () => {
    const { application } = inboundArrival("tactical-d");
    issueInstruction(application, { headingDegrees: 360, speedKnots: 200 });
    awaitReadback(application);
    advanceSteps(application, 20);
    expect(arrival(application).speedKnots).toBe(200);

    const departed = advanceUntil(
      application,
      (snapshot) =>
        snapshot.aircraft.find(({ id }) => id === ARRIVAL_ID)?.flightPhase ===
        "out-of-play",
      10_000,
    ).aircraft.find(({ id }) => id === ARRIVAL_ID);
    expect(departed).toMatchObject({
      exit: "departed",
      pilotState: "complete",
      activeTacticalInstruction: undefined,
    });
    expect(
      Math.hypot(
        departed!.position.eastNauticalMiles,
        departed!.position.northNauticalMiles,
      ),
    ).toBeCloseTo(8, 1);
  });

  it("replaces one vector with the next heading instruction", () => {
    const { application } = inboundArrival("tactical-d");
    issueInstruction(application, { headingDegrees: 360 });
    awaitReadback(application);
    advanceSteps(application, 50);
    const northbound = arrival(application);
    expect(headingError(northbound.trackDegrees, 360)).toBeCloseTo(0, 3);

    issueInstruction(application, { headingDegrees: 90 });
    awaitReadback(application);
    advanceSteps(application, 50);
    const eastbound = arrival(application);
    expect(headingError(eastbound.trackDegrees, 90)).toBeCloseTo(0, 3);
    expect(eastbound.position.eastNauticalMiles).toBeGreaterThan(
      northbound.position.eastNauticalMiles,
    );
    // It keeps flying north only until the new heading is read back.
    expect(
      eastbound.position.northNauticalMiles - northbound.position.northNauticalMiles,
    ).toBeLessThan(0.3);
  });

  it("complies with altitude and speed instructions while staying on the inbound path", () => {
    const { application } = inboundArrival("tactical-d");
    const before = arrival(application);
    issueInstruction(application, { altitudeFeet: before.altitudeFeet + 1_000, speedKnots: 150 });
    awaitReadback(application);
    advanceSteps(application, 100);

    const after = arrival(application);
    expect(after.speedKnots).toBe(150);
    expect(after.altitudeFeet).toBeGreaterThan(before.altitudeFeet);
    expect(after.altitudeFeet).toBeLessThanOrEqual(before.altitudeFeet + 1_000);
    expect(after.flightPhase).toBe("inbound");
    // Still tracking toward the final approach fix, not on a vector.
    expect(after.trackDegrees).toBeCloseTo(before.trackDegrees, 5);
  });
});
