export type OperatingPosture = "observe" | "assist" | "take-the-sector";

type StaticVfrWeather = {
  preset:
    | "light-northerly"
    | "westerly"
    | "southwesterly"
    | "light-easterly";
  windDirectionDegrees: number;
  windSpeedKnots: number;
  visibilityStatuteMiles: number;
  ceilingFeet: number;
};

const FLOW_FIELD_GEOMETRY = {
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

type AirportGeometry = typeof FLOW_FIELD_GEOMETRY;

const AIRCRAFT_CAPABILITY_PROFILES = [
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

type AircraftCapabilityProfiles = typeof AIRCRAFT_CAPABILITY_PROFILES;
type AircraftCapabilityProfileId = AircraftCapabilityProfiles[number]["id"];

type RunwayClearanceKind =
  | "hold-short"
  | "line-up-and-wait"
  | "cancel-runway-clearance"
  | "clear-for-takeoff"
  | "clear-to-land"
  | "clear-touch-and-go"
  | "go-around";

type RunwayClearance = {
  kind: RunwayClearanceKind;
  runwayId: "09-27" | "04-22";
  runwayEnd: "09" | "27" | "04" | "22";
};

type CandidateRunwayClearance = {
  aircraftId: string;
  clearance: RunwayClearance;
};

type TacticalInstruction = {
  headingDegrees?: number;
  altitudeFeet?: number;
  speedKnots?: number;
  circuit?: { action: "enter" | "adjust"; circuitId: "runway-09-left" };
  sequenceBehindAircraftId?: string;
  extendCircuitLeg?: "upwind" | "crosswind" | "downwind" | "base";
  localHoldId?: "northwest-hold" | "southeast-hold";
  orbitDirection?: "left" | "right";
};

type AircraftFlightPhase =
  | "hold-short"
  | "inbound"
  | "approach"
  | "circuit"
  | "departure"
  | "out-of-play";

type PilotState =
  | "ready"
  | "awaiting-contact"
  | "monitoring"
  | "awaiting-readback"
  | "operating"
  | "complete";

type Aircraft = {
  id: string;
  callsign: string;
  capabilityProfileId: AircraftCapabilityProfileId;
  position: { eastNauticalMiles: number; northNauticalMiles: number };
  trackDegrees: number;
  headingDegrees: number;
  altitudeFeet: number;
  speedKnots: number;
  flightPhase: AircraftFlightPhase;
  intention: "departure" | "arrival" | "circuit";
  pilotState: PilotState;
  activeRunwayClearance?: RunwayClearance;
  activeTacticalInstruction?: TacticalInstruction;
  exit?: "departed" | "landed";
};

type Transmission = {
  sequence: number;
  speaker: "controller" | "pilot";
  aircraftId: string;
  text: string;
  simulationTimeMs: number;
};

type PendingPilotReadback = {
  aircraftId: string;
  text: string;
  dueAtSimulationTimeMs: number;
};

type AircraftLifecycle = {
  operatingAtMs: number;
  completeAtMs: number;
  operatingFlightPhase: Extract<AircraftFlightPhase, "approach" | "circuit" | "departure">;
  exit: "departed" | "landed";
  runwayUse?: {
    runwayId: "09-27" | "04-22";
    operation: "departure" | "arrival";
    beginsAtMs: number;
    clearsAtMs: number;
  };
  aircraft: Aircraft;
};

const INITIAL_AIRCRAFT_LIFECYCLES: readonly AircraftLifecycle[] = [
  {
    operatingAtMs: 10_000,
    completeAtMs: 30_000,
    operatingFlightPhase: "departure",
    exit: "departed",
    runwayUse: {
      runwayId: "09-27",
      operation: "departure",
      beginsAtMs: 10_000,
      clearsAtMs: 30_000,
    },
    aircraft: {
      id: "fc-101",
      callsign: "FLOW 101",
      capabilityProfileId: "cessna-172",
      position: { eastNauticalMiles: -0.95, northNauticalMiles: 0 },
      trackDegrees: 90,
      headingDegrees: 90,
      altitudeFeet: 0,
      speedKnots: 0,
      flightPhase: "hold-short",
      intention: "departure",
      pilotState: "ready",
    },
  },
  {
    operatingAtMs: 20_000,
    completeAtMs: 40_000,
    operatingFlightPhase: "approach",
    exit: "landed",
    runwayUse: {
      runwayId: "04-22",
      operation: "arrival",
      beginsAtMs: 30_000,
      clearsAtMs: 40_000,
    },
    aircraft: {
      id: "fc-202",
      callsign: "FLOW 202",
      capabilityProfileId: "king-air-350",
      position: { eastNauticalMiles: -6, northNauticalMiles: 0 },
      trackDegrees: 90,
      headingDegrees: 90,
      altitudeFeet: 3_000,
      speedKnots: 180,
      flightPhase: "inbound",
      intention: "arrival",
      pilotState: "awaiting-contact",
    },
  },
  {
    operatingAtMs: 30_000,
    completeAtMs: 160_000,
    operatingFlightPhase: "approach",
    exit: "landed",
    runwayUse: {
      runwayId: "04-22",
      operation: "arrival",
      beginsAtMs: 150_000,
      clearsAtMs: 160_000,
    },
    aircraft: {
      id: "fc-303",
      callsign: "FLOW 303",
      capabilityProfileId: "atr-72-600",
      position: { eastNauticalMiles: 0, northNauticalMiles: 6 },
      trackDegrees: 180,
      headingDegrees: 180,
      altitudeFeet: 3_500,
      speedKnots: 190,
      flightPhase: "inbound",
      intention: "arrival",
      pilotState: "awaiting-contact",
    },
  },
  {
    operatingAtMs: 40_000,
    completeAtMs: 150_000,
    operatingFlightPhase: "departure",
    exit: "departed",
    runwayUse: {
      runwayId: "09-27",
      operation: "departure",
      beginsAtMs: 40_000,
      clearsAtMs: 150_000,
    },
    aircraft: {
      id: "fc-404",
      callsign: "FLOW 404",
      capabilityProfileId: "boeing-737-8",
      position: { eastNauticalMiles: 0.95, northNauticalMiles: 0 },
      trackDegrees: 270,
      headingDegrees: 270,
      altitudeFeet: 0,
      speedKnots: 0,
      flightPhase: "hold-short",
      intention: "departure",
      pilotState: "ready",
    },
  },
  {
    operatingAtMs: 50_000,
    completeAtMs: 190_000,
    operatingFlightPhase: "approach",
    exit: "landed",
    runwayUse: {
      runwayId: "09-27",
      operation: "arrival",
      beginsAtMs: 180_000,
      clearsAtMs: 190_000,
    },
    aircraft: {
      id: "fc-505",
      callsign: "FLOW 505",
      capabilityProfileId: "airbus-a330-900",
      position: { eastNauticalMiles: 0, northNauticalMiles: -6 },
      trackDegrees: 0,
      headingDegrees: 0,
      altitudeFeet: 4_000,
      speedKnots: 210,
      flightPhase: "inbound",
      intention: "arrival",
      pilotState: "awaiting-contact",
    },
  },
  {
    operatingAtMs: 60_000,
    completeAtMs: 210_000,
    operatingFlightPhase: "circuit",
    exit: "landed",
    aircraft: {
      id: "fc-106",
      callsign: "FLOW 106",
      capabilityProfileId: "cessna-172",
      position: { eastNauticalMiles: 1, northNauticalMiles: 1.5 },
      trackDegrees: 270,
      headingDegrees: 270,
      altitudeFeet: 1_000,
      speedKnots: 90,
      flightPhase: "circuit",
      intention: "circuit",
      pilotState: "monitoring",
    },
  },
];

type RunwayResources = {
  runwayOccupancy: Array<{
    runwayId: "09-27" | "04-22";
    aircraftId: string;
    callsign: string;
    operation: "departure" | "arrival";
    clearsAtSimulationTimeMs: number;
  }>;
  intersectionOccupancy: Array<{
    intersectionId: string;
    aircraftIds: string[];
    runwayIds: Array<"09-27" | "04-22">;
  }>;
};

type Capability =
  | "begin_tower_shift"
  | "get_tower_snapshot"
  | "wait_for_tower_event"
  | "get_selected_context"
  | "get_active_conflicts"
  | "evaluate_clearance_set"
  | "stage_clearance_plan"
  | "stage_recovery_plan"
  | "issue_runway_clearance"
  | "issue_tactical_instruction";

type OperationalReceipt = {
  actor:
    | "tower-agent"
    | "supervising-controller"
    | "capability-registry"
    | "simulation-clock";
  action:
    | "shift-began"
    | "aircraft-state-transition"
    | "runway-resources-transition"
    | "runway-clearance-issued"
    | "tactical-instruction-issued"
    | "pilot-readback-received"
    | "operating-posture-reduced"
    | "operating-posture-increase-requested"
    | "operating-posture-increase-confirmed"
    | "capability-synchronization-completed"
    | "clearance-plan-staged";
  simulationTimeMs: number;
  stateVersionBefore: number;
  stateVersionAfter: number;
};

type ApplicationState = {
  scenarioSeed: string;
  weather: StaticVfrWeather;
  airport: AirportGeometry;
  aircraftCapabilityProfiles: AircraftCapabilityProfiles;
  aircraft: Aircraft[];
  runwayResources: RunwayResources;
  transmissions: Transmission[];
  pendingPilotReadbacks: PendingPilotReadback[];
  nextTransmissionSequence: number;
  operatingPosture: OperatingPosture;
  pendingOperatingPosture?: OperatingPosture;
  capabilitySynchronization?: "awaiting-confirmation" | "pending";
  stagedClearancePlanReference?: string;
  shiftStatus: "armed" | "active";
  simulationTimeMs: number;
  stateVersion: number;
  operationalReceipts: OperationalReceipt[];
};

export type TowerSnapshot = Pick<
  ApplicationState,
  "shiftStatus" | "scenarioSeed" | "operatingPosture" | "stateVersion"
> & {
  simulationTimeMs: number;
  weather: StaticVfrWeather;
  airport: AirportGeometry;
  aircraftCapabilityProfiles: AircraftCapabilityProfiles;
  aircraft: Aircraft[];
  runwayResources: RunwayResources;
  transmissions: Transmission[];
  pendingOperatingPosture?: OperatingPosture;
  capabilitySynchronization?: "awaiting-confirmation" | "pending";
  stagedClearancePlanReference?: string;
};

type Query =
  | { type: "available-capabilities" }
  | { type: "tower-snapshot" }
  | { type: "operational-receipts" }
  | { type: "transmissions" }
  | {
      type: "evaluate-clearance-set";
      expectedStateVersion: number;
      runwayClearances: CandidateRunwayClearance[];
    }
  | { type: "capabilities-to-register" }
  | { type: "connection-health" }
  | {
      type: "wait-for-tower-event";
      cursor: number;
      heartbeatAfterMs: number;
      signal?: AbortSignal;
    };

type BeginShiftCommand = {
  type: "begin-shift";
  actor: "tower-agent";
  expectedStateVersion: number;
};

type ReduceOperatingPostureCommand = {
  type: "reduce-operating-posture";
  actor: "supervising-controller";
  operatingPosture: "observe";
  expectedStateVersion: number;
};

type RequestOperatingPostureIncreaseCommand = {
  type: "request-operating-posture-increase";
  actor: "supervising-controller";
  operatingPosture: "take-the-sector";
  expectedStateVersion: number;
};

type ConfirmOperatingPostureIncreaseCommand = {
  type: "confirm-operating-posture-increase";
  actor: "supervising-controller";
  expectedStateVersion: number;
};

type CompleteCapabilitySynchronizationCommand = {
  type: "complete-capability-synchronization";
  actor: "capability-registry";
  expectedStateVersion: number;
};

type RenewAgentLeaseCommand = {
  type: "renew-agent-lease";
  actor: "capability-registry";
};

type SetAgentWaitCommand = {
  type: "set-agent-wait";
  actor: "capability-registry";
  active: boolean;
};

type StageClearancePlanCommand = {
  type: "stage-clearance-plan";
  actor: "tower-agent";
  planReference: string;
  expectedStateVersion: number;
};

type AdvanceSimulationCommand = {
  type: "advance-simulation";
  actor: "simulation-clock";
  steps?: number;
};

type IssueRunwayClearanceCommand = {
  type: "issue-runway-clearance";
  actor: "tower-agent" | "supervising-controller";
  aircraftId: string;
  clearance: RunwayClearance;
  expectedStateVersion: number;
};

type IssueTacticalInstructionCommand = {
  type: "issue-tactical-instruction";
  actor: "tower-agent" | "supervising-controller";
  aircraftId: string;
  instruction: TacticalInstruction;
  expectedStateVersion: number;
};

type Command =
  | BeginShiftCommand
  | ReduceOperatingPostureCommand
  | RequestOperatingPostureIncreaseCommand
  | ConfirmOperatingPostureIncreaseCommand
  | CompleteCapabilitySynchronizationCommand
  | RenewAgentLeaseCommand
  | SetAgentWaitCommand
  | StageClearancePlanCommand
  | IssueRunwayClearanceCommand
  | IssueTacticalInstructionCommand
  | AdvanceSimulationCommand;

const OBSERVE_CAPABILITIES: Capability[] = [
  "get_tower_snapshot",
  "wait_for_tower_event",
  "get_selected_context",
  "get_active_conflicts",
  "evaluate_clearance_set",
];

const POSTURE_LABELS: Record<OperatingPosture, string> = {
  observe: "Observe",
  assist: "Assist",
  "take-the-sector": "Take the Sector",
};

const VFR_WEATHER_PRESETS: readonly StaticVfrWeather[] = [
  {
    preset: "light-northerly",
    windDirectionDegrees: 350,
    windSpeedKnots: 6,
    visibilityStatuteMiles: 10,
    ceilingFeet: 6_000,
  },
  {
    preset: "westerly",
    windDirectionDegrees: 270,
    windSpeedKnots: 10,
    visibilityStatuteMiles: 10,
    ceilingFeet: 5_000,
  },
  {
    preset: "southwesterly",
    windDirectionDegrees: 220,
    windSpeedKnots: 12,
    visibilityStatuteMiles: 8,
    ceilingFeet: 4_500,
  },
  {
    preset: "light-easterly",
    windDirectionDegrees: 80,
    windSpeedKnots: 7,
    visibilityStatuteMiles: 10,
    ceilingFeet: 5_500,
  },
];

function createSeededRandom(scenarioSeed: string) {
  let state = 2_166_136_261;
  for (let index = 0; index < scenarioSeed.length; index += 1) {
    state ^= scenarioSeed.charCodeAt(index);
    state = Math.imul(state, 16_777_619) >>> 0;
  }
  state ||= 0x9e3779b9;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function selectStaticVfrWeather(random: () => number): StaticVfrWeather {
  const preset =
    VFR_WEATHER_PRESETS[
      Math.floor(random() * VFR_WEATHER_PRESETS.length)
    ];
  return { ...preset };
}

function generateScenario(scenarioSeed: string) {
  const random = createSeededRandom(scenarioSeed);
  return {
    weather: selectStaticVfrWeather(random),
    airport: structuredClone(FLOW_FIELD_GEOMETRY),
    aircraftCapabilityProfiles: structuredClone(AIRCRAFT_CAPABILITY_PROFILES),
    aircraft: structuredClone(
      INITIAL_AIRCRAFT_LIFECYCLES.map(({ aircraft }) => aircraft),
    ),
    runwayResources: { runwayOccupancy: [], intersectionOccupancy: [] },
    transmissions: [],
    pendingPilotReadbacks: [],
    nextTransmissionSequence: 1,
  };
}

const RUNWAY_CLEARANCE_PHRASES: Record<RunwayClearanceKind, string> = {
  "hold-short": "hold short",
  "line-up-and-wait": "line up and wait",
  "cancel-runway-clearance": "cancel runway clearance",
  "clear-for-takeoff": "cleared for takeoff",
  "clear-to-land": "cleared to land",
  "clear-touch-and-go": "cleared touch-and-go",
  "go-around": "go around",
};

function runwayClearanceText(callsign: string, clearance: RunwayClearance) {
  return `${callsign}, ${RUNWAY_CLEARANCE_PHRASES[clearance.kind]} runway ${clearance.runwayEnd}.`;
}

function tacticalInstructionText(
  callsign: string,
  instruction: TacticalInstruction,
) {
  const parts = [
    instruction.headingDegrees === undefined
      ? undefined
      : `heading ${instruction.headingDegrees}`,
    instruction.altitudeFeet === undefined
      ? undefined
      : `altitude ${instruction.altitudeFeet} feet`,
    instruction.speedKnots === undefined
      ? undefined
      : `speed ${instruction.speedKnots} knots`,
    instruction.circuit === undefined
      ? undefined
      : `${instruction.circuit.action} circuit ${instruction.circuit.circuitId}`,
    instruction.sequenceBehindAircraftId === undefined
      ? undefined
      : `sequence behind ${instruction.sequenceBehindAircraftId}`,
    instruction.extendCircuitLeg === undefined
      ? undefined
      : `extend ${instruction.extendCircuitLeg}`,
    instruction.localHoldId === undefined
      ? undefined
      : `hold at ${instruction.localHoldId}`,
    instruction.orbitDirection === undefined
      ? undefined
      : `${instruction.orbitDirection} 360`,
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : `${callsign}, ${parts.join(", ")}.`;
}

function appendTransmission(
  state: ApplicationState,
  speaker: Transmission["speaker"],
  aircraftId: string,
  text: string,
) {
  state.transmissions.push({
    sequence: state.nextTransmissionSequence,
    speaker,
    aircraftId,
    text,
    simulationTimeMs: state.simulationTimeMs,
  });
  state.nextTransmissionSequence += 1;
}

function queuePilotReadback(
  state: ApplicationState,
  aircraftId: string,
  text: string,
) {
  state.pendingPilotReadbacks.push({
    aircraftId,
    text,
    dueAtSimulationTimeMs: state.simulationTimeMs + 1_000,
  });
}

function deliverDuePilotReadbacks(state: ApplicationState) {
  const dueReadbacks = state.pendingPilotReadbacks.filter(
    ({ dueAtSimulationTimeMs }) =>
      dueAtSimulationTimeMs <= state.simulationTimeMs,
  );
  state.pendingPilotReadbacks = state.pendingPilotReadbacks.filter(
    ({ dueAtSimulationTimeMs }) =>
      dueAtSimulationTimeMs > state.simulationTimeMs,
  );
  for (const readback of dueReadbacks) {
    appendTransmission(state, "pilot", readback.aircraftId, readback.text);
    state.aircraft = state.aircraft.map((aircraft) =>
      aircraft.id === readback.aircraftId && aircraft.flightPhase !== "out-of-play"
        ? { ...aircraft, pilotState: "operating" }
        : aircraft,
    );
  }
  return dueReadbacks;
}

function runwayResourcesAt(
  airport: AirportGeometry,
  simulationTimeMs: number,
): RunwayResources {
  const runwayOccupancy = INITIAL_AIRCRAFT_LIFECYCLES.flatMap((lifecycle) => {
    const runwayUse = lifecycle.runwayUse;
    if (
      !runwayUse ||
      simulationTimeMs < runwayUse.beginsAtMs ||
      simulationTimeMs >= runwayUse.clearsAtMs
    ) {
      return [];
    }
    return [
      {
        runwayId: runwayUse.runwayId,
        aircraftId: lifecycle.aircraft.id,
        callsign: lifecycle.aircraft.callsign,
        operation: runwayUse.operation,
        clearsAtSimulationTimeMs: runwayUse.clearsAtMs,
      },
    ];
  });
  const intersectionOccupancy = airport.intersections.flatMap(
    (intersection) => {
      const occupants = runwayOccupancy.filter((occupancy) =>
        intersection.runwayIds.includes(occupancy.runwayId),
      );
      return occupants.length === 0
        ? []
        : [
            {
              intersectionId: intersection.id,
              aircraftIds: occupants.map(({ aircraftId }) => aircraftId),
              runwayIds: occupants.map(({ runwayId }) => runwayId),
            },
          ];
    },
  );
  return { runwayOccupancy, intersectionOccupancy };
}

function advanceRunwayResources(state: ApplicationState) {
  const nextResources = runwayResourcesAt(
    state.airport,
    state.simulationTimeMs,
  );
  if (
    JSON.stringify(nextResources) === JSON.stringify(state.runwayResources)
  ) {
    return false;
  }
  state.runwayResources = nextResources;
  return true;
}

function evaluateRunwayClearanceSet(
  state: ApplicationState,
  runwayClearances: CandidateRunwayClearance[],
) {
  const conflicts: Array<{
    kind: "runway-occupied" | "intersection-occupied";
    resourceId: string;
    aircraftIds: string[];
  }> = [];
  const constraints: Array<{
    kind: "runway-capability";
    aircraftId: string;
    resourceId: string;
    requiredMinimumRunway: { lengthFeet: number; widthFeet: number };
    availableRunway: { lengthFeet: number; widthFeet: number };
  }> = [];
  const mustIssueBy: number[] = [];

  for (const candidate of runwayClearances) {
    const aircraft = state.aircraft.find(
      ({ id }) => id === candidate.aircraftId,
    );
    const capabilityProfile = state.aircraftCapabilityProfiles.find(
      ({ id }) => id === aircraft?.capabilityProfileId,
    );
    const runway = state.airport.runways.find(
      ({ id }) => id === candidate.clearance.runwayId,
    );
    if (
      aircraft &&
      capabilityProfile &&
      runway &&
      (runway.lengthFeet < capabilityProfile.minimumRunway.lengthFeet ||
        runway.widthFeet < capabilityProfile.minimumRunway.widthFeet)
    ) {
      constraints.push({
        kind: "runway-capability",
        aircraftId: aircraft.id,
        resourceId: runway.id,
        requiredMinimumRunway: { ...capabilityProfile.minimumRunway },
        availableRunway: {
          lengthFeet: runway.lengthFeet,
          widthFeet: runway.widthFeet,
        },
      });
    }

    const occupiedRunway = state.runwayResources.runwayOccupancy.filter(
      ({ runwayId }) => runwayId === candidate.clearance.runwayId,
    );
    if (occupiedRunway.length > 0) {
      conflicts.push({
        kind: "runway-occupied",
        resourceId: candidate.clearance.runwayId,
        aircraftIds: [
          ...occupiedRunway.map(({ aircraftId }) => aircraftId),
          candidate.aircraftId,
        ],
      });
      mustIssueBy.push(
        ...occupiedRunway.map(({ clearsAtSimulationTimeMs }) =>
          clearsAtSimulationTimeMs,
        ),
      );
    }

    for (const intersection of state.airport.intersections) {
      if (!intersection.runwayIds.includes(candidate.clearance.runwayId)) {
        continue;
      }
      const intersectionOccupants = state.runwayResources.runwayOccupancy.filter(
        ({ runwayId }) => intersection.runwayIds.includes(runwayId),
      );
      if (intersectionOccupants.length === 0) {
        continue;
      }
      conflicts.push({
        kind: "intersection-occupied",
        resourceId: intersection.id,
        aircraftIds: [
          ...intersectionOccupants.map(({ aircraftId }) => aircraftId),
          candidate.aircraftId,
        ],
      });
      mustIssueBy.push(
        ...intersectionOccupants.map(({ clearsAtSimulationTimeMs }) =>
          clearsAtSimulationTimeMs,
        ),
      );
    }
  }

  const affectedAircraft = [
    ...new Set([
      ...conflicts.flatMap(({ aircraftIds }) => aircraftIds),
      ...constraints.map(({ aircraftId }) => aircraftId),
    ]),
  ];
  if (conflicts.length === 0 && constraints.length === 0) {
    return {
      status: "success" as const,
      valid: true,
      evaluatedStateVersion: state.stateVersion,
      simulationTimeMs: state.simulationTimeMs,
      affectedAircraft,
      conflicts,
      constraints,
      nextAction: "continue" as const,
    };
  }

  return {
    status: "refusal" as const,
    valid: false,
    evaluatedStateVersion: state.stateVersion,
    simulationTimeMs: state.simulationTimeMs,
    affectedAircraft,
    conflicts,
    constraints,
    ...(mustIssueBy.length > 0
      ? { mustIssueBySimulationTimeMs: Math.min(...mustIssueBy) }
      : {}),
    nextAction:
      conflicts.length > 0
        ? ("wait-for-runway-resource" as const)
        : ("select-suitable-runway" as const),
  };
}

function advanceAircraftState(state: ApplicationState) {
  const transitionedCallsigns: string[] = [];
  state.aircraft = state.aircraft.map((aircraft) => {
    const lifecycle = INITIAL_AIRCRAFT_LIFECYCLES.find(
      ({ aircraft: initialAircraft }) => initialAircraft.id === aircraft.id,
    );
    if (!lifecycle || aircraft.flightPhase === "out-of-play") {
      return aircraft;
    }

    if (state.simulationTimeMs >= lifecycle.completeAtMs) {
      transitionedCallsigns.push(aircraft.callsign);
      return {
        ...aircraft,
        flightPhase: "out-of-play",
        pilotState: "complete",
        exit: lifecycle.exit,
      };
    }

    if (
      state.simulationTimeMs >= lifecycle.operatingAtMs &&
      aircraft.pilotState !== "operating"
    ) {
      transitionedCallsigns.push(aircraft.callsign);
      return {
        ...aircraft,
        flightPhase: lifecycle.operatingFlightPhase,
        pilotState: "operating",
      };
    }

    return aircraft;
  });
  return transitionedCallsigns;
}

function activeCapabilities(posture: OperatingPosture): Capability[] {
  if (posture === "observe") {
    return [...OBSERVE_CAPABILITIES];
  }

  const capabilities: Capability[] = [
    ...OBSERVE_CAPABILITIES,
    "stage_clearance_plan",
    "stage_recovery_plan",
  ];

  if (posture === "take-the-sector") {
    capabilities.push(
      "issue_runway_clearance",
      "issue_tactical_instruction",
    );
  }

  return capabilities;
}

export function createFlowControlApplication(options: {
  scenarioSeed: string;
  operatingPosture: OperatingPosture;
  simulation?: {
    fixedTimeStepMs: number;
    paceMultiplier: number;
  };
  wallClockNow?: () => number;
  connectionLease?: {
    warningAfterMs: number;
    unavailableAfterMs: number;
    reconnectedForMs?: number;
  };
}) {
  const {
    wallClockNow = Date.now,
    connectionLease = {
      warningAfterMs: 30_000,
      unavailableAfterMs: 60_000,
    },
    simulation = {
      fixedTimeStepMs: 100,
      paceMultiplier: 1,
    },
    ...initialState
  } = options;
  const scenario = generateScenario(initialState.scenarioSeed);
  const state: ApplicationState = {
    ...initialState,
    ...scenario,
    shiftStatus: "armed",
    simulationTimeMs: 0,
    stateVersion: 0,
    operationalReceipts: [],
  };
  let lastAgentContactAt: number | undefined;
  let reconnectedUntil: number | undefined;
  let activeAgentWaits = 0;
  const subscribers = new Set<(snapshot: TowerSnapshot) => void>();

  function towerSnapshot(): TowerSnapshot {
    return {
      shiftStatus: state.shiftStatus,
      scenarioSeed: state.scenarioSeed,
      weather: { ...state.weather },
      airport: structuredClone(state.airport),
      aircraftCapabilityProfiles: structuredClone(state.aircraftCapabilityProfiles),
      aircraft: structuredClone(state.aircraft),
      runwayResources: structuredClone(state.runwayResources),
      transmissions: structuredClone(state.transmissions),
      operatingPosture: state.operatingPosture,
      simulationTimeMs: state.simulationTimeMs,
      stateVersion: state.stateVersion,
      pendingOperatingPosture: state.pendingOperatingPosture,
      capabilitySynchronization: state.capabilitySynchronization,
      stagedClearancePlanReference: state.stagedClearancePlanReference,
    };
  }

  function connectionHealth() {
    const now = wallClockNow();
    const silenceMs = Math.max(0, now - (lastAgentContactAt ?? now));
    const connectionState =
      activeAgentWaits > 0
        ? "healthy"
        : reconnectedUntil !== undefined && now < reconnectedUntil
        ? "reconnected"
        : silenceMs >= connectionLease.unavailableAfterMs
          ? "unavailable"
          : silenceMs >= connectionLease.warningAfterMs
            ? "warning"
            : "healthy";
    return { state: connectionState, silenceMs };
  }

  return {
    command(command: Command) {
      if (command.type === "renew-agent-lease") {
        const now = wallClockNow();
        const wasUnavailable =
          lastAgentContactAt !== undefined &&
          now - lastAgentContactAt >= connectionLease.unavailableAfterMs;
        lastAgentContactAt = now;
        if (wasUnavailable) {
          reconnectedUntil =
            now + (connectionLease.reconnectedForMs ?? 10_000);
        }
        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: "Tower Agent connection lease renewed.",
          nextAction: "continue" as const,
        };
      }

      if (command.type === "set-agent-wait") {
        activeAgentWaits = command.active
          ? activeAgentWaits + 1
          : Math.max(0, activeAgentWaits - 1);
        if (!command.active) {
          lastAgentContactAt = wallClockNow();
        }
        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: command.active
            ? "Tower Agent wait is active."
            : "Tower Agent wait completed.",
          nextAction: "continue" as const,
        };
      }

      if (command.type === "advance-simulation") {
        if (state.shiftStatus !== "active") {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Simulation time cannot advance before the Shift begins.",
            nextAction: "begin_tower_shift" as const,
          };
        }

        const steps = command.steps ?? 1;
        if (!Number.isInteger(steps) || steps < 1) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Simulation advance requires at least one whole timestep.",
            nextAction: "continue" as const,
          };
        }

        for (let step = 0; step < steps; step += 1) {
          state.simulationTimeMs +=
            simulation.fixedTimeStepMs * simulation.paceMultiplier;
          for (const callsign of advanceAircraftState(state)) {
            const stateVersionBefore = state.stateVersion;
            state.stateVersion += 1;
            state.operationalReceipts.push({
              actor: command.actor,
              action: "aircraft-state-transition",
              simulationTimeMs: state.simulationTimeMs,
              stateVersionBefore,
              stateVersionAfter: state.stateVersion,
            });
          }
          if (advanceRunwayResources(state)) {
            const stateVersionBefore = state.stateVersion;
            state.stateVersion += 1;
            state.operationalReceipts.push({
              actor: command.actor,
              action: "runway-resources-transition",
              simulationTimeMs: state.simulationTimeMs,
              stateVersionBefore,
              stateVersionAfter: state.stateVersion,
            });
          }
          for (const readback of deliverDuePilotReadbacks(state)) {
            const stateVersionBefore = state.stateVersion;
            state.stateVersion += 1;
            state.operationalReceipts.push({
              actor: "simulation-clock",
              action: "pilot-readback-received",
              simulationTimeMs: state.simulationTimeMs,
              stateVersionBefore,
              stateVersionAfter: state.stateVersion,
            });
          }
        }
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          simulationTimeMs: state.simulationTimeMs,
          summary: `Simulation advanced to ${state.simulationTimeMs} ms.`,
          nextAction: "continue" as const,
        };
      }

      if (command.expectedStateVersion !== state.stateVersion) {
        return {
          status: "stale" as const,
          stateVersion: state.stateVersion,
          summary:
            "Shift start refused because the expected State Version is stale.",
          rationale: `Expected State Version ${command.expectedStateVersion}; current State Version is ${state.stateVersion}.`,
          nextAction: "get_tower_snapshot" as const,
        };
      }

      if (command.type === "issue-runway-clearance") {
        if (
          command.actor === "tower-agent" &&
          state.operatingPosture !== "take-the-sector"
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Runway Clearance requires Take the Sector.",
            rationale:
              `${POSTURE_LABELS[state.operatingPosture]} does not delegate runway Clearance dispatch to the Tower Agent.`,
            nextAction: "request-authority-increase" as const,
          };
        }

        const aircraft = state.aircraft.find(
          ({ id }) => id === command.aircraftId,
        );
        if (!aircraft || aircraft.flightPhase === "out-of-play") {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Runway Clearance requires an active aircraft.",
            nextAction: "get_tower_snapshot" as const,
          };
        }

        const evaluation = evaluateRunwayClearanceSet(state, [
          {
            aircraftId: aircraft.id,
            clearance: command.clearance,
          },
        ]);
        if (!evaluation.valid) {
          const constraint = evaluation.constraints[0];
          const conflict = evaluation.conflicts[0];
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Runway Clearance refused by policy.",
            rationale: constraint
              ? `Runway ${constraint.resourceId} cannot satisfy ${aircraft.callsign} minimum runway capability.`
              : `Runway resource ${conflict.resourceId} is occupied.`,
            nextAction: evaluation.nextAction,
          };
        }

        const text = runwayClearanceText(aircraft.callsign, command.clearance);
        state.aircraft = state.aircraft.map((candidate) =>
          candidate.id === aircraft.id
            ? {
                ...candidate,
                activeRunwayClearance: structuredClone(command.clearance),
                pilotState: "awaiting-readback",
              }
            : candidate,
        );
        appendTransmission(state, "controller", aircraft.id, text);
        queuePilotReadback(state, aircraft.id, text);
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "runway-clearance-issued",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `${text} Pilot readback is pending.`,
          nextAction: "continue" as const,
        };
      }

      if (command.type === "issue-tactical-instruction") {
        if (
          command.actor === "tower-agent" &&
          state.operatingPosture !== "take-the-sector"
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Tactical Instruction requires Take the Sector.",
            rationale:
              `${POSTURE_LABELS[state.operatingPosture]} does not delegate Tactical Instruction dispatch to the Tower Agent.`,
            nextAction: "request-authority-increase" as const,
          };
        }

        const aircraft = state.aircraft.find(
          ({ id }) => id === command.aircraftId,
        );
        if (!aircraft || aircraft.flightPhase === "out-of-play") {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Tactical Instruction requires an active aircraft.",
            nextAction: "get_tower_snapshot" as const,
          };
        }
        const text = tacticalInstructionText(
          aircraft.callsign,
          command.instruction,
        );
        if (!text) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Tactical Instruction requires at least one direction.",
            nextAction: "get_tower_snapshot" as const,
          };
        }

        state.aircraft = state.aircraft.map((candidate) =>
          candidate.id === aircraft.id
            ? {
                ...candidate,
                activeTacticalInstruction: structuredClone(command.instruction),
                pilotState: "awaiting-readback",
              }
            : candidate,
        );
        appendTransmission(state, "controller", aircraft.id, text);
        queuePilotReadback(state, aircraft.id, text);
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "tactical-instruction-issued",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `${text} Pilot readback is pending.`,
          nextAction: "continue" as const,
        };
      }

      if (
        command.type === "stage-clearance-plan" &&
        state.operatingPosture === "observe"
      ) {
        return {
          status: "refusal" as const,
          stateVersion: state.stateVersion,
          summary:
            "Clearance Plan staging requires Assist or Take the Sector.",
          rationale: "Observe permits read and evaluation capabilities only.",
          nextAction: "request-authority-increase" as const,
        };
      }

      if (command.type === "stage-clearance-plan") {
        state.stagedClearancePlanReference = command.planReference;
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "clearance-plan-staged",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `Clearance Plan ${command.planReference} staged for human review.`,
          nextAction: "await-plan-review" as const,
        };
      }

      if (command.type === "reduce-operating-posture") {
        state.operatingPosture = command.operatingPosture;
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "operating-posture-reduced",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: "Operating Posture reduced to Observe.",
          nextAction: "wait_for_tower_event" as const,
        };
      }

      if (command.type === "request-operating-posture-increase") {
        state.pendingOperatingPosture = command.operatingPosture;
        state.capabilitySynchronization = "awaiting-confirmation";
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "operating-posture-increase-requested",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "approval-required" as const,
          stateVersion: state.stateVersion,
          summary: "Take the Sector grant is pending human confirmation.",
          nextAction: "confirm-operating-posture-increase" as const,
        };
      }

      if (command.type === "confirm-operating-posture-increase") {
        state.capabilitySynchronization = "pending";
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "operating-posture-increase-confirmed",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary:
            "Take the Sector grant confirmed; capability synchronization is pending.",
          nextAction: "synchronize-capabilities" as const,
        };
      }

      if (command.type === "complete-capability-synchronization") {
        state.operatingPosture = state.pendingOperatingPosture ?? "observe";
        delete state.pendingOperatingPosture;
        delete state.capabilitySynchronization;
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "capability-synchronization-completed",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: "Take the Sector capability synchronization completed.",
          nextAction: "wait_for_tower_event" as const,
        };
      }

      if (state.shiftStatus === "active") {
        return {
          status: "refusal" as const,
          stateVersion: state.stateVersion,
          summary: "Shift start refused because the Shift is already active.",
          rationale: "A Shift may be begun only once.",
          nextAction: "get_tower_snapshot" as const,
        };
      }

      const stateVersionBefore = state.stateVersion;
      state.shiftStatus = "active";
      lastAgentContactAt = wallClockNow();
      state.stateVersion += 1;
      state.operationalReceipts.push({
        actor: command.actor,
        action: "shift-began",
        simulationTimeMs: state.simulationTimeMs,
        stateVersionBefore,
        stateVersionAfter: state.stateVersion,
      });
      const snapshot = towerSnapshot();
      subscribers.forEach((subscriber) => subscriber(snapshot));

      return {
        status: "success" as const,
        stateVersion: state.stateVersion,
        summary: `Tower Agent connected; Shift ${state.scenarioSeed} is active in ${POSTURE_LABELS[state.operatingPosture]}.`,
        nextAction: "get_tower_snapshot" as const,
      };
    },

    query(query: Query) {
      switch (query.type) {
        case "available-capabilities":
          return state.shiftStatus === "armed"
            ? (["begin_tower_shift"] satisfies Capability[])
            : activeCapabilities(state.operatingPosture);
        case "tower-snapshot":
          return towerSnapshot();
        case "capabilities-to-register":
          return state.capabilitySynchronization === "pending" &&
            state.pendingOperatingPosture
            ? activeCapabilities(state.pendingOperatingPosture)
            : state.shiftStatus === "armed"
              ? (["begin_tower_shift"] satisfies Capability[])
              : activeCapabilities(state.operatingPosture);
        case "operational-receipts":
          return [...state.operationalReceipts];
        case "transmissions":
          return structuredClone(state.transmissions);
        case "evaluate-clearance-set":
          if (query.expectedStateVersion !== state.stateVersion) {
            return {
              status: "stale" as const,
              evaluatedStateVersion: state.stateVersion,
              simulationTimeMs: state.simulationTimeMs,
              affectedAircraft: [],
              summary: "Clearance-set evaluation requires the current State Version.",
              nextAction: "get_tower_snapshot" as const,
            };
          }
          return evaluateRunwayClearanceSet(state, query.runwayClearances);
        case "connection-health": {
          return connectionHealth();
        }
        case "wait-for-tower-event":
          if (state.shiftStatus !== "active") {
            return Promise.resolve({
              eventKind: "monitoring-unavailable",
              priority: "attention",
              cursor: query.cursor,
              stateVersion: state.stateVersion,
              simulationTime: 0,
              summary: "Monitoring is unavailable until the Shift is active.",
              actionRequired: true,
            });
          }
          return new Promise((resolve) => {
            const finish = (result: Record<string, unknown>) => {
              query.signal?.removeEventListener("abort", cancel);
              resolve(result);
            };
            const cancel = () => {
              globalThis.clearTimeout(timer);
              finish({
                eventKind: "wait-cancelled",
                priority: "routine",
                cursor: query.cursor,
                stateVersion: state.stateVersion,
                simulationTime: 0,
                summary: "Tower-event wait was cancelled.",
                actionRequired: false,
              });
            };
            const timer = globalThis.setTimeout(() => {
              finish({
                eventKind: "heartbeat",
                priority: "routine",
                cursor: query.cursor,
                stateVersion: state.stateVersion,
                simulationTime: 0,
                summary: "Tower Agent monitoring is current.",
                actionRequired: false,
              });
            }, query.heartbeatAfterMs);

            if (query.signal?.aborted) {
              cancel();
            } else {
              query.signal?.addEventListener("abort", cancel, { once: true });
            }
          });
      }
    },

    subscribe(subscriber: (snapshot: TowerSnapshot) => void) {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
  };
}

export type FlowControlApplication = ReturnType<
  typeof createFlowControlApplication
>;
