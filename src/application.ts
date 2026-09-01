export type OperatingPosture = "observe" | "assist" | "take-the-sector";

type ActionCategory = "runway-clearance" | "tactical-instruction";
type CategoryOverride = "allowed" | "withheld";

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
  alternatives?: RunwayClearance[];
};

type ActionClassification =
  | "routine"
  | "elevated"
  | "exceptional-recovery";

type ClearancePlanAlternative = {
  id: string;
  clearance: RunwayClearance;
};

type ClearancePlanMember = {
  id: string;
  aircraftId: string;
  clearance: RunwayClearance;
  selected: boolean;
  alternatives: ClearancePlanAlternative[];
};

type CandidateTacticalInstruction = {
  aircraftId: string;
  instruction: TacticalInstruction;
};

type TacticalPlanMember = {
  id: string;
  aircraftId: string;
  instruction: TacticalInstruction;
  selected: boolean;
};

type ClearancePlan = {
  reference: string;
  runwayClearances: CandidateRunwayClearance[];
  members: ClearancePlanMember[];
  tacticalInstructions: CandidateTacticalInstruction[];
  tacticalMembers: TacticalPlanMember[];
  classification: ActionClassification;
  evaluatedStateVersion: number;
  expiresAtSimulationTimeMs: number;
};

type RecoveryPlan = ClearancePlan;

function clearancePlanMembers(
  reference: string,
  runwayClearances: CandidateRunwayClearance[],
): ClearancePlanMember[] {
  return runwayClearances.map((candidate, index) => {
    const id = `${reference}:runway-clearance:${index + 1}`;
    return {
      id,
      aircraftId: candidate.aircraftId,
      clearance: structuredClone(candidate.clearance),
      selected: true,
      alternatives: (candidate.alternatives ?? []).map(
        (clearance, alternativeIndex) => ({
          id: `${id}:alternative:${alternativeIndex + 1}`,
          clearance: structuredClone(clearance),
        }),
      ),
    };
  });
}

function tacticalPlanMembers(
  reference: string,
  tacticalInstructions: CandidateTacticalInstruction[],
): TacticalPlanMember[] {
  return tacticalInstructions.map((candidate, index) => ({
    id: `${reference}:tactical-instruction:${index + 1}`,
    aircraftId: candidate.aircraftId,
    instruction: structuredClone(candidate.instruction),
    selected: true,
  }));
}

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
  kind: "readback" | "unable";
  dueAtSimulationTimeMs: number;
};

type RosterRole = "departure" | "arrival" | "circuit";

type RosterAssignment = {
  entersPlayAtMs: number;
  role: RosterRole;
  runwayId: "09-27" | "04-22";
  runwayEnd: "09" | "27" | "04" | "22";
  aircraft: Aircraft;
};

const BASE_ROSTER: readonly RosterAssignment[] = [
  {
    entersPlayAtMs: 0,
    role: "departure",
    runwayId: "09-27",
    runwayEnd: "09",
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
    entersPlayAtMs: 20_000,
    role: "arrival",
    runwayId: "04-22",
    runwayEnd: "04",
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
    entersPlayAtMs: 40_000,
    role: "arrival",
    runwayId: "04-22",
    runwayEnd: "22",
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
    entersPlayAtMs: 0,
    role: "departure",
    runwayId: "09-27",
    runwayEnd: "27",
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
    entersPlayAtMs: 60_000,
    role: "arrival",
    runwayId: "09-27",
    runwayEnd: "27",
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
    entersPlayAtMs: 10_000,
    role: "circuit",
    runwayId: "09-27",
    runwayEnd: "09",
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

type MapPoint = { eastNauticalMiles: number; northNauticalMiles: number };

export type EventDeck = {
  emergency: {
    aircraftId: string;
    declareAtSimulationTimeMs: number;
    status: "pending" | "declared" | "resolved";
    resolvedAtSimulationTimeMs?: number;
  };
  rejectedTakeoff: {
    aircraftId: string;
    rejectAfterRollMs: number;
    status: "pending" | "armed" | "rejected" | "resolved";
    rejectedAtSimulationTimeMs?: number;
  };
  independentGoAround: {
    aircraftId: string;
    status: "pending" | "executed" | "resolved";
  };
  temporaryLimitation: {
    aircraftId: string;
    activeFromSimulationTimeMs: number;
    activeUntilSimulationTimeMs: number;
    reason: string;
    status: "pending" | "active" | "reported" | "expired";
  };
};

type TrafficStage =
  | "waiting"
  | "hold-short"
  | "lined-up"
  | "takeoff-roll"
  | "rejected"
  | "climb-out"
  | "inbound"
  | "approach"
  | "go-around"
  | "rollout"
  | "circuit"
  | "done";

type AircraftProgress = {
  role: RosterRole;
  entersPlayAtMs: number;
  runwayId: "09-27" | "04-22";
  runwayEnd: "09" | "27" | "04" | "22";
  stage: TrafficStage;
  waypoints: MapPoint[];
  waypointIndex: number;
  stageStartedAtMs: number;
  approachAttempts: number;
  committedToLand?: boolean;
  forcedGoAroundOnNextGate?: boolean;
  lapDecision?: "touch-and-go" | "full-stop" | "extend";
};

type OccupancyRecord = {
  runwayId: "09-27" | "04-22";
  aircraftId: string;
  callsign: string;
  operation: "departure" | "arrival";
  wakeCategory: "light" | "medium" | "heavy";
  beganAtSimulationTimeMs: number;
  clearsAtSimulationTimeMs: number;
};

const FEET_PER_NAUTICAL_MILE = 6_076.12;
const FINAL_APPROACH_FIX_DISTANCE_NM = 4;
const LANDING_DECISION_GATE_NM = 1.2;
const TAKEOFF_ROLL_DURATION_MS = 15_000;
const DEPARTURE_OCCUPANCY_MS = 20_000;
const ARRIVAL_OCCUPANCY_MS = 10_000;
const TOUCH_AND_GO_OCCUPANCY_MS = 5_000;
const LINE_UP_OCCUPANCY_MS = 120_000;
const REJECTED_TAKEOFF_OCCUPANCY_MS = 75_000;
const EVENT_SPACING_QUIET_PERIOD_MS = 20_000;
const STABLE_FLOW_HOLD_MS = 15_000;

function headingUnitVector(headingDegrees: number): MapPoint {
  const radians = (headingDegrees * Math.PI) / 180;
  return {
    eastNauticalMiles: Math.sin(radians),
    northNauticalMiles: Math.cos(radians),
  };
}

function runwayEndHeadingDegrees(runwayEnd: "09" | "27" | "04" | "22") {
  return Number(runwayEnd) * 10;
}

function runwayThreshold(
  airport: AirportGeometry,
  runwayId: "09-27" | "04-22",
  runwayEnd: "09" | "27" | "04" | "22",
): MapPoint {
  const runway = airport.runways.find(({ id }) => id === runwayId);
  if (!runway) {
    throw new Error(`Unknown runway ${runwayId}.`);
  }
  const halfLengthNm = runway.lengthFeet / FEET_PER_NAUTICAL_MILE / 2;
  const direction = headingUnitVector(runwayEndHeadingDegrees(runwayEnd));
  return {
    eastNauticalMiles:
      runway.center.eastNauticalMiles - halfLengthNm * direction.eastNauticalMiles,
    northNauticalMiles:
      runway.center.northNauticalMiles - halfLengthNm * direction.northNauticalMiles,
  };
}

function addScaled(origin: MapPoint, direction: MapPoint, distanceNm: number): MapPoint {
  return {
    eastNauticalMiles: origin.eastNauticalMiles + direction.eastNauticalMiles * distanceNm,
    northNauticalMiles:
      origin.northNauticalMiles + direction.northNauticalMiles * distanceNm,
  };
}

function distanceBetween(first: MapPoint, second: MapPoint) {
  return Math.hypot(
    first.eastNauticalMiles - second.eastNauticalMiles,
    first.northNauticalMiles - second.northNauticalMiles,
  );
}

function headingTowards(from: MapPoint, to: MapPoint) {
  const degrees =
    (Math.atan2(
      to.eastNauticalMiles - from.eastNauticalMiles,
      to.northNauticalMiles - from.northNauticalMiles,
    ) *
      180) /
    Math.PI;
  return (degrees + 360) % 360;
}

function finalApproachFix(
  airport: AirportGeometry,
  runwayId: "09-27" | "04-22",
  runwayEnd: "09" | "27" | "04" | "22",
): MapPoint {
  const threshold = runwayThreshold(airport, runwayId, runwayEnd);
  const approachDirection = headingUnitVector(runwayEndHeadingDegrees(runwayEnd));
  return addScaled(threshold, approachDirection, -FINAL_APPROACH_FIX_DISTANCE_NM);
}

function missedApproachWaypoints(
  airport: AirportGeometry,
  runwayId: "09-27" | "04-22",
  runwayEnd: "09" | "27" | "04" | "22",
): MapPoint[] {
  const runway = airport.runways.find(({ id }) => id === runwayId);
  if (!runway) {
    throw new Error(`Unknown runway ${runwayId}.`);
  }
  const flightDirection = headingUnitVector(runwayEndHeadingDegrees(runwayEnd));
  const leftOffset = headingUnitVector(runwayEndHeadingDegrees(runwayEnd) - 90);
  const threshold = runwayThreshold(airport, runwayId, runwayEnd);
  const runwayLengthNm = runway.lengthFeet / FEET_PER_NAUTICAL_MILE;
  const departureEnd = addScaled(threshold, flightDirection, runwayLengthNm + 0.3);
  const crosswindTurn = addScaled(departureEnd, leftOffset, 1);
  const shortFinalFix = addScaled(threshold, flightDirection, -2.2);
  const rejoin = addScaled(shortFinalFix, leftOffset, 1);
  return [departureEnd, crosswindTurn, rejoin, shortFinalFix];
}

function circuitDefinitionFor(
  airport: AirportGeometry,
  runwayId: "09-27" | "04-22",
  runwayEnd: "09" | "27" | "04" | "22",
) {
  const circuit = airport.circuits.find(
    (candidate) =>
      candidate.runwayId === runwayId && candidate.runwayEnd === runwayEnd,
  );
  if (!circuit) {
    throw new Error(`No circuit is published for runway ${runwayEnd}.`);
  }
  return circuit;
}

function circuitLoopWaypoints(
  airport: AirportGeometry,
  runwayId: "09-27" | "04-22",
  runwayEnd: "09" | "27" | "04" | "22",
): MapPoint[] {
  const circuit = circuitDefinitionFor(airport, runwayId, runwayEnd);
  return circuit.legs.map(({ to }) => ({ ...to }));
}

function circuitEntryWaypoints(
  airport: AirportGeometry,
  runwayId: "09-27" | "04-22",
  runwayEnd: "09" | "27" | "04" | "22",
): MapPoint[] {
  const circuit = circuitDefinitionFor(airport, runwayId, runwayEnd);
  return circuit.legs
    .filter(({ id }) => id === "downwind" || id === "base" || id === "final")
    .map(({ to }) => ({ ...to }));
}

function initialProgressFor(assignment: RosterAssignment): AircraftProgress {
  return {
    role: assignment.role,
    entersPlayAtMs: assignment.entersPlayAtMs,
    runwayId: assignment.runwayId,
    runwayEnd: assignment.runwayEnd,
    stage: assignment.role === "departure" ? "hold-short" : "waiting",
    waypoints: [],
    waypointIndex: 0,
    stageStartedAtMs: 0,
    approachAttempts: 0,
  };
}

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

export type ActiveConflictScope = "all" | "current" | "predicted";

export type ActiveConflict = {
  id: string;
  kind: "runway-separation" | "intersection-separation";
  status: "current" | "predicted";
  resourceId: string;
  aircraftIds: string[];
  beginsAtSimulationTimeMs: number;
  endsAtSimulationTimeMs: number;
  runwayIds: Array<"09-27" | "04-22">;
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
    | "category-override-updated"
    | "clearance-plan-staged"
    | "recovery-plan-staged"
    | "clearance-plan-expired"
    | "recovery-plan-expired"
    | "clearance-plan-invalidated"
    | "recovery-plan-invalidated"
    | "clearance-plan-member-selection-updated"
    | "clearance-plan-dispatched"
    | "clearance-plan-alternative-selected"
    | "clearance-plan-tactical-instruction-edited"
    | "recovery-plan-approved-and-dispatched"
    | "pilot-go-around-executed"
    | "emergency-declared"
    | "takeoff-rejected"
    | "pilot-unable-reported"
    | "stable-flow-restored"
    | "shift-completed"
    | "webmcp-tool-executed";
  simulationTimeMs: number;
  stateVersionBefore: number;
  stateVersionAfter: number;
  summary?: string;
  webMcp?: {
    capability: Capability;
    input: unknown;
    result: Record<string, unknown>;
    actor: "tower-agent";
    authority: {
      operatingPosture: OperatingPosture;
      categoryOverrides: Partial<Record<ActionCategory, CategoryOverride>>;
    };
    startedAtWallClockMs: number;
    durationMs: number;
  };
};

type ApplicationState = {
  scenarioSeed: string;
  controllerScreenName?: string;
  weather: StaticVfrWeather;
  airport: AirportGeometry;
  aircraftCapabilityProfiles: AircraftCapabilityProfiles;
  aircraft: Aircraft[];
  aircraftProgress: Record<string, AircraftProgress>;
  runwayOccupancies: OccupancyRecord[];
  eventDeck: EventDeck;
  runwayResources: RunwayResources;
  transmissions: Transmission[];
  pendingPilotReadbacks: PendingPilotReadback[];
  nextTransmissionSequence: number;
  operatingPosture: OperatingPosture;
  categoryOverrides: Partial<Record<ActionCategory, CategoryOverride>>;
  pendingOperatingPosture?: OperatingPosture;
  capabilitySynchronization?: "awaiting-confirmation" | "pending";
  stagedClearancePlanReference?: string;
  stagedClearancePlan?: ClearancePlan;
  stagedRecoveryPlan?: RecoveryPlan;
  selectedAircraftId?: string;
  shiftStatus: "armed" | "active" | "completed" | "incomplete";
  simulationTimeMs: number;
  stateVersion: number;
  stableSinceSimulationTimeMs?: number;
  operationalReceipts: OperationalReceipt[];
};

export type TowerSnapshot = Pick<
  ApplicationState,
  | "shiftStatus"
  | "scenarioSeed"
  | "controllerScreenName"
  | "operatingPosture"
  | "stateVersion"
  | "selectedAircraftId"
> & {
  eventCursor: number;
  simulationTimeMs: number;
  weather: StaticVfrWeather;
  airport: AirportGeometry;
  aircraftCapabilityProfiles: AircraftCapabilityProfiles;
  aircraft: Aircraft[];
  runwayResources: RunwayResources;
  transmissions: Transmission[];
  categoryOverrides: Partial<Record<ActionCategory, CategoryOverride>>;
  pendingOperatingPosture?: OperatingPosture;
  capabilitySynchronization?: "awaiting-confirmation" | "pending";
  stagedClearancePlanReference?: string;
  stagedClearancePlan?: ClearancePlan;
  stagedRecoveryPlan?: RecoveryPlan;
};

export type TowerSnapshotSection =
  | "authority"
  | "weather"
  | "runways"
  | "traffic"
  | "plans"
  | "transmissions";

export type TowerSnapshotDetail = "compact" | "full";

type Query =
  | { type: "available-capabilities" }
  | {
      type: "tower-snapshot";
      sections?: TowerSnapshotSection[];
      detail?: TowerSnapshotDetail;
    }
  | { type: "operational-receipts" }
  | { type: "transmissions" }
  | { type: "selected-context" }
  | {
      type: "active-conflicts";
      scope?: ActiveConflictScope;
      detail?: TowerSnapshotDetail;
      lookaheadMs?: number;
    }
  | {
      type: "evaluate-clearance-set";
      expectedStateVersion: number;
      effectiveAtSimulationTimeMs?: number;
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

type SetCategoryOverrideCommand = {
  type: "set-category-override";
  actor: "supervising-controller";
  category: ActionCategory;
  disposition: CategoryOverride;
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

type RecordWebMcpToolExecutionCommand = {
  type: "record-webmcp-tool-execution";
  actor: "tower-agent";
  capability: Capability;
  input: unknown;
  result: Record<string, unknown>;
  stateVersionBefore: number;
  startedAtWallClockMs: number;
  durationMs: number;
};

type SelectAircraftCommand = {
  type: "select-aircraft";
  actor: "supervising-controller";
  aircraftId: string;
};

type StageClearancePlanCommand = {
  type: "stage-clearance-plan";
  actor: "tower-agent";
  planReference: string;
  runwayClearances?: CandidateRunwayClearance[];
  tacticalInstructions?: CandidateTacticalInstruction[];
  expectedStateVersion: number;
};

type StageRecoveryPlanCommand = {
  type: "stage-recovery-plan";
  actor: "tower-agent";
  planReference: string;
  runwayClearances: CandidateRunwayClearance[];
  expectedStateVersion: number;
};

type SetClearancePlanMemberSelectionCommand = {
  type: "set-clearance-plan-member-selection";
  actor: "supervising-controller";
  memberId: string;
  selected: boolean;
  expectedStateVersion: number;
};

type DispatchSelectedClearancePlanCommand = {
  type: "dispatch-selected-clearance-plan";
  actor: "supervising-controller";
  expectedStateVersion: number;
};

type SelectClearancePlanAlternativeCommand = {
  type: "select-clearance-plan-alternative";
  actor: "supervising-controller";
  memberId: string;
  alternativeId: string;
  expectedStateVersion: number;
};

type EditClearancePlanTacticalInstructionCommand = {
  type: "edit-clearance-plan-tactical-instruction";
  actor: "supervising-controller";
  memberId: string;
  changes: Pick<
    TacticalInstruction,
    "headingDegrees" | "altitudeFeet" | "speedKnots"
  >;
  expectedStateVersion: number;
};

type ApproveRecoveryPlanCommand = {
  type: "approve-recovery-plan";
  actor: "supervising-controller";
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
  | SetCategoryOverrideCommand
  | RenewAgentLeaseCommand
  | SetAgentWaitCommand
  | RecordWebMcpToolExecutionCommand
  | SelectAircraftCommand
  | StageClearancePlanCommand
  | StageRecoveryPlanCommand
  | SetClearancePlanMemberSelectionCommand
  | DispatchSelectedClearancePlanCommand
  | SelectClearancePlanAlternativeCommand
  | EditClearancePlanTacticalInstructionCommand
  | ApproveRecoveryPlanCommand
  | IssueRunwayClearanceCommand
  | IssueTacticalInstructionCommand
  | AdvanceSimulationCommand;

function staleCommandSummary(commandType: Command["type"]) {
  if (commandType === "dispatch-selected-clearance-plan") {
    return "Clearance Plan dispatch refused because the expected State Version is stale.";
  }
  if (commandType === "issue-runway-clearance") {
    return "Runway Clearance refused because the expected State Version is stale.";
  }
  if (commandType === "issue-tactical-instruction") {
    return "Tactical Instruction refused because the expected State Version is stale.";
  }
  if (commandType === "stage-clearance-plan") {
    return "Clearance Plan staging refused because the expected State Version is stale.";
  }
  if (commandType === "stage-recovery-plan") {
    return "Recovery Plan staging refused because the expected State Version is stale.";
  }
  return "Shift start refused because the expected State Version is stale.";
}

const NON_MONITORING_RECEIPT_ACTIONS = new Set<OperationalReceipt["action"]>([
  "shift-began",
  "webmcp-tool-executed",
]);

function monitoringReceipts(receipts: readonly OperationalReceipt[]) {
  return receipts.filter(
    ({ action, actor }) =>
      actor !== "tower-agent" && !NON_MONITORING_RECEIPT_ACTIONS.has(action),
  );
}

function monitoringEventAt(
  receipts: readonly OperationalReceipt[],
  cursor: number,
) {
  const receipt = monitoringReceipts(receipts)[cursor];
  if (!receipt) {
    return undefined;
  }
  const routineActions = new Set<OperationalReceipt["action"]>([
    "aircraft-state-transition",
    "runway-resources-transition",
    "pilot-readback-received",
  ]);
  const actionRequired = !routineActions.has(receipt.action);
  return {
    eventKind: receipt.action,
    priority: actionRequired ? ("attention" as const) : ("routine" as const),
    cursor: cursor + 1,
    stateVersion: receipt.stateVersionAfter,
    simulationTime: receipt.simulationTimeMs,
    summary: `${receipt.action.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase())}.`,
    actionRequired,
  };
}

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

const WAKE_SPACING_AFTER_MS = {
  light: 5_000,
  medium: 10_000,
  heavy: 20_000,
} as const;

const PLAN_EXPIRY_WINDOW_MS = 30_000;

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

export const FIRST_LAUNCH_SCENARIO_SEED = "flow-first-shift";

function seededSeventhAircraft(random: () => number): RosterAssignment {
  if (random() < 0.5) {
    return {
      entersPlayAtMs: 90_000 + Math.floor(random() * 20) * 1_000,
      role: "circuit",
      runwayId: "09-27",
      runwayEnd: "09",
      aircraft: {
        id: "fc-108",
        callsign: "FLOW 108",
        capabilityProfileId: "cessna-172",
        position: { eastNauticalMiles: 1.6, northNauticalMiles: 1.5 },
        trackDegrees: 270,
        headingDegrees: 270,
        altitudeFeet: 1_000,
        speedKnots: 90,
        flightPhase: "circuit",
        intention: "circuit",
        pilotState: "monitoring",
      },
    };
  }
  return {
    entersPlayAtMs: 100_000 + Math.floor(random() * 20) * 1_000,
    role: "arrival",
    runwayId: "09-27",
    runwayEnd: "27",
    aircraft: {
      id: "fc-207",
      callsign: "FLOW 207",
      capabilityProfileId: "king-air-350",
      position: { eastNauticalMiles: 6.5, northNauticalMiles: -2 },
      trackDegrees: 320,
      headingDegrees: 320,
      altitudeFeet: 3_000,
      speedKnots: 180,
      flightPhase: "inbound",
      intention: "arrival",
      pilotState: "awaiting-contact",
    },
  };
}

export function generateScenario(scenarioSeed: string) {
  const random = createSeededRandom(scenarioSeed);
  const weather = selectStaticVfrWeather(random);
  const roster: RosterAssignment[] = BASE_ROSTER.map((assignment) => ({
    ...assignment,
    entersPlayAtMs:
      assignment.role === "departure"
        ? 0
        : assignment.entersPlayAtMs + Math.floor(random() * 20) * 1_000,
    aircraft: structuredClone(assignment.aircraft),
  }));
  roster.push(seededSeventhAircraft(random));

  const arrivals = roster.filter(({ role }) => role === "arrival");
  const departures = roster.filter(({ role }) => role === "departure");
  const emergency = arrivals[Math.floor(random() * arrivals.length)];
  const independentCandidates = arrivals.filter(
    (candidate) => candidate !== emergency,
  );
  const independent =
    independentCandidates[
      Math.floor(random() * independentCandidates.length)
    ];
  const rejected = departures[Math.floor(random() * departures.length)];
  const limitedCandidates = arrivals.filter(
    (candidate) => candidate !== emergency && candidate !== independent,
  );
  const limited =
    limitedCandidates[Math.floor(random() * limitedCandidates.length)];
  const declareAtSimulationTimeMs =
    emergency.entersPlayAtMs + 10_000 + Math.floor(random() * 10) * 1_000;
  const eventDeck: EventDeck = {
    emergency: {
      aircraftId: emergency.aircraft.id,
      declareAtSimulationTimeMs,
      status: "pending",
    },
    rejectedTakeoff: {
      aircraftId: rejected.aircraft.id,
      rejectAfterRollMs: 6_000 + Math.floor(random() * 4) * 1_000,
      status: "pending",
    },
    independentGoAround: {
      aircraftId: independent.aircraft.id,
      status: "pending",
    },
    temporaryLimitation: {
      aircraftId: limited.aircraft.id,
      activeFromSimulationTimeMs: 0,
      activeUntilSimulationTimeMs: Number.MAX_SAFE_INTEGER,
      reason: "unsafe gear indication, request delay",
      status: "pending",
    },
  };

  return {
    weather,
    airport: structuredClone(FLOW_FIELD_GEOMETRY),
    aircraftCapabilityProfiles: structuredClone(AIRCRAFT_CAPABILITY_PROFILES),
    aircraft: roster.map(({ aircraft }) => aircraft),
    aircraftProgress: Object.fromEntries(
      roster.map((assignment) => [
        assignment.aircraft.id,
        initialProgressFor(assignment),
      ]),
    ),
    runwayOccupancies: [] as OccupancyRecord[],
    eventDeck,
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

function isValidPlanTacticalInstruction(instruction: TacticalInstruction) {
  return (
    tacticalInstructionText("Plan", instruction) !== undefined &&
    (instruction.headingDegrees === undefined ||
      (Number.isInteger(instruction.headingDegrees) &&
        instruction.headingDegrees >= 1 &&
        instruction.headingDegrees <= 360)) &&
    (instruction.altitudeFeet === undefined ||
      (Number.isInteger(instruction.altitudeFeet) && instruction.altitudeFeet > 0)) &&
    (instruction.speedKnots === undefined ||
      (Number.isInteger(instruction.speedKnots) && instruction.speedKnots > 0))
  );
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
  kind: PendingPilotReadback["kind"] = "readback",
) {
  state.pendingPilotReadbacks.push({
    aircraftId,
    text,
    kind,
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
    if (readback.kind === "unable") {
      state.eventDeck.temporaryLimitation.status =
        state.eventDeck.temporaryLimitation.aircraftId === readback.aircraftId
          ? "reported"
          : state.eventDeck.temporaryLimitation.status;
    }
    state.aircraft = state.aircraft.map((aircraft) =>
      aircraft.id === readback.aircraftId && aircraft.flightPhase !== "out-of-play"
        ? {
            ...aircraft,
            pilotState: readback.kind === "unable" ? "monitoring" : "operating",
          }
        : aircraft,
    );
  }
  return dueReadbacks;
}

function runwayResourcesAt(
  state: ApplicationState,
  simulationTimeMs: number,
): RunwayResources {
  const airport = state.airport;
  const runwayOccupancy = state.runwayOccupancies.flatMap((occupancy) => {
    if (
      simulationTimeMs < occupancy.beganAtSimulationTimeMs ||
      simulationTimeMs >= occupancy.clearsAtSimulationTimeMs
    ) {
      return [];
    }
    return [
      {
        runwayId: occupancy.runwayId,
        aircraftId: occupancy.aircraftId,
        callsign: occupancy.callsign,
        operation: occupancy.operation,
        clearsAtSimulationTimeMs: occupancy.clearsAtSimulationTimeMs,
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

function activeConflictsAt(
  state: ApplicationState,
  {
    scope = "all",
    detail = "compact",
    lookaheadMs = 120_000,
  }: {
    scope?: ActiveConflictScope;
    detail?: TowerSnapshotDetail;
    lookaheadMs?: number;
  } = {},
) {
  const occupancyWindows = state.runwayOccupancies
    .filter(
      ({ clearsAtSimulationTimeMs }) =>
        clearsAtSimulationTimeMs > state.simulationTimeMs,
    )
    .map((occupancy) => ({
      aircraftId: occupancy.aircraftId,
      runwayId: occupancy.runwayId,
      beginsAtMs: occupancy.beganAtSimulationTimeMs,
      clearsAtMs: occupancy.clearsAtSimulationTimeMs,
    }));
  const predictedDemands = state.aircraft.flatMap((aircraft) => {
    const clearance = aircraft.activeRunwayClearance;
    const progress = state.aircraftProgress[aircraft.id];
    if (!clearance || !progress || aircraft.flightPhase === "out-of-play") {
      return [];
    }
    if (
      clearance.kind === "clear-to-land" &&
      (progress.stage === "inbound" ||
        progress.stage === "approach" ||
        progress.stage === "go-around")
    ) {
      const threshold = runwayThreshold(
        state.airport,
        progress.runwayId,
        progress.runwayEnd,
      );
      const distanceNm = distanceBetween(aircraft.position, threshold);
      const speedKnots = Math.max(aircraft.speedKnots, 60);
      const etaMs = (distanceNm / speedKnots) * 3_600_000;
      return [
        {
          aircraftId: aircraft.id,
          runwayId: clearance.runwayId,
          beginsAtMs: state.simulationTimeMs + etaMs,
          clearsAtMs: state.simulationTimeMs + etaMs + ARRIVAL_OCCUPANCY_MS,
        },
      ];
    }
    if (
      clearance.kind === "clear-for-takeoff" &&
      (progress.stage === "hold-short" || progress.stage === "lined-up")
    ) {
      return [
        {
          aircraftId: aircraft.id,
          runwayId: clearance.runwayId,
          beginsAtMs: state.simulationTimeMs + 2_000,
          clearsAtMs: state.simulationTimeMs + 2_000 + DEPARTURE_OCCUPANCY_MS,
        },
      ];
    }
    return [];
  });
  const scheduledRunwayUses = [
    ...occupancyWindows,
    ...predictedDemands.filter(
      (demand) =>
        !occupancyWindows.some(
          ({ aircraftId }) => aircraftId === demand.aircraftId,
        ),
    ),
  ];
  const conflicts: ActiveConflict[] = [];

  for (
    let firstIndex = 0;
    firstIndex < scheduledRunwayUses.length;
    firstIndex += 1
  ) {
    const first = scheduledRunwayUses[firstIndex];
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < scheduledRunwayUses.length;
      secondIndex += 1
    ) {
      const second = scheduledRunwayUses[secondIndex];
      const beginsAtSimulationTimeMs = Math.max(
        first.beginsAtMs,
        second.beginsAtMs,
      );
      const endsAtSimulationTimeMs = Math.min(
        first.clearsAtMs,
        second.clearsAtMs,
      );
      if (beginsAtSimulationTimeMs >= endsAtSimulationTimeMs) {
        continue;
      }

      const sharedIntersection = state.airport.intersections.find(
        ({ runwayIds }) =>
          first.runwayId !== second.runwayId &&
          runwayIds.includes(first.runwayId) &&
          runwayIds.includes(second.runwayId),
      );
      if (first.runwayId !== second.runwayId && !sharedIntersection) {
        continue;
      }

      const status =
        beginsAtSimulationTimeMs <= state.simulationTimeMs &&
        state.simulationTimeMs < endsAtSimulationTimeMs
          ? "current"
          : beginsAtSimulationTimeMs > state.simulationTimeMs &&
              beginsAtSimulationTimeMs <= state.simulationTimeMs + lookaheadMs
            ? "predicted"
            : undefined;
      if (!status) {
        continue;
      }

      const aircraftIds = [first.aircraftId, second.aircraftId].sort();
      const runwayIds = [first.runwayId, second.runwayId].filter(
        (runwayId, index, all) => all.indexOf(runwayId) === index,
      );
      const kind =
        first.runwayId === second.runwayId
          ? "runway-separation"
          : "intersection-separation";
      const resourceId = sharedIntersection?.id ?? first.runwayId;
      conflicts.push({
        id: `${kind}:${resourceId}:${aircraftIds.join(":")}:${beginsAtSimulationTimeMs}`,
        kind,
        status,
        resourceId,
        aircraftIds,
        beginsAtSimulationTimeMs,
        endsAtSimulationTimeMs,
        runwayIds,
      });
    }
  }

  const project = (conflict: ActiveConflict) =>
    detail === "full"
      ? structuredClone(conflict)
      : {
          id: conflict.id,
          kind: conflict.kind,
          status: conflict.status,
          resourceId: conflict.resourceId,
          aircraftIds: [...conflict.aircraftIds],
          beginsAtSimulationTimeMs: conflict.beginsAtSimulationTimeMs,
          endsAtSimulationTimeMs: conflict.endsAtSimulationTimeMs,
        };
  return {
    asOfSimulationTimeMs: state.simulationTimeMs,
    predictionHorizonMs: lookaheadMs,
    current:
      scope === "predicted"
        ? []
        : conflicts.filter(({ status }) => status === "current").map(project),
    predicted:
      scope === "current"
        ? []
        : conflicts.filter(({ status }) => status === "predicted").map(project),
  };
}

function advanceRunwayResources(state: ApplicationState) {
  const nextResources = runwayResourcesAt(state, state.simulationTimeMs);
  if (
    JSON.stringify(nextResources) === JSON.stringify(state.runwayResources)
  ) {
    return false;
  }
  state.runwayResources = nextResources;
  return true;
}

function expireStagedPlans(state: ApplicationState) {
  const expired: Array<
    Extract<
      OperationalReceipt["action"],
      "clearance-plan-expired" | "recovery-plan-expired"
    >
  > = [];
  if (
    state.stagedClearancePlan &&
    state.stagedClearancePlan.expiresAtSimulationTimeMs <=
      state.simulationTimeMs
  ) {
    delete state.stagedClearancePlan;
    delete state.stagedClearancePlanReference;
    expired.push("clearance-plan-expired");
  }
  if (
    state.stagedRecoveryPlan &&
    state.stagedRecoveryPlan.expiresAtSimulationTimeMs <= state.simulationTimeMs
  ) {
    delete state.stagedRecoveryPlan;
    expired.push("recovery-plan-expired");
  }
  return expired;
}

function invalidateStagedPlans(state: ApplicationState) {
  const invalidated: Array<
    Extract<
      OperationalReceipt["action"],
      "clearance-plan-invalidated" | "recovery-plan-invalidated"
    >
  > = [];
  if (state.stagedClearancePlan) {
    delete state.stagedClearancePlan;
    delete state.stagedClearancePlanReference;
    invalidated.push("clearance-plan-invalidated");
  }
  if (state.stagedRecoveryPlan) {
    delete state.stagedRecoveryPlan;
    invalidated.push("recovery-plan-invalidated");
  }
  return invalidated;
}

function evaluateRunwayClearanceSet(
  state: ApplicationState,
  runwayClearances: CandidateRunwayClearance[],
  effectiveAtSimulationTimeMs = state.simulationTimeMs,
) {
  const hasProtectiveClearance = runwayClearances.some(
    ({ clearance }) =>
      clearance.kind === "go-around" ||
      clearance.kind === "cancel-runway-clearance",
  );
  const deckDisrupted =
    state.eventDeck.emergency.status === "declared" ||
    state.eventDeck.rejectedTakeoff.status === "rejected";
  const declaredEmergencyAircraftId =
    state.eventDeck.emergency.status === "declared"
      ? state.eventDeck.emergency.aircraftId
      : undefined;
  const classification: ActionClassification =
    runwayClearances.length > 1 && (hasProtectiveClearance || deckDisrupted)
      ? "exceptional-recovery"
      : hasProtectiveClearance ||
          (runwayClearances.length === 1 &&
            runwayClearances[0].aircraftId === declaredEmergencyAircraftId)
        ? "elevated"
        : "routine";
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
  } | {
    kind: "wake-separation";
    resourceId: string;
    leaderAircraftId: string;
    followerAircraftId: string;
    requiredSpacingMs: number;
    availableSpacingMs: number;
  }> = [];
  const mustIssueBy: number[] = [];
  const projectedResources = runwayResourcesAt(
    state,
    effectiveAtSimulationTimeMs,
  );

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

    const precedingRelease = state.runwayOccupancies
      .filter(
        (occupancy) =>
          occupancy.runwayId === candidate.clearance.runwayId &&
          occupancy.aircraftId !== candidate.aircraftId &&
          occupancy.clearsAtSimulationTimeMs <= effectiveAtSimulationTimeMs,
      )
      .sort(
        (first, second) =>
          second.clearsAtSimulationTimeMs - first.clearsAtSimulationTimeMs,
      )[0];
    if (precedingRelease) {
      const availableSpacingMs =
        effectiveAtSimulationTimeMs - precedingRelease.clearsAtSimulationTimeMs;
      const requiredSpacingMs =
        WAKE_SPACING_AFTER_MS[precedingRelease.wakeCategory];
      if (availableSpacingMs < requiredSpacingMs) {
        constraints.push({
          kind: "wake-separation",
          resourceId: candidate.clearance.runwayId,
          leaderAircraftId: precedingRelease.aircraftId,
          followerAircraftId: candidate.aircraftId,
          requiredSpacingMs,
          availableSpacingMs,
        });
      }
    }

    const occupiedRunway = projectedResources.runwayOccupancy.filter(
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
      const intersectionOccupants = projectedResources.runwayOccupancy.filter(
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
      ...constraints.flatMap((constraint) =>
        constraint.kind === "runway-capability"
          ? [constraint.aircraftId]
          : [constraint.leaderAircraftId, constraint.followerAircraftId],
      ),
    ]),
  ];
  if (conflicts.length === 0 && constraints.length === 0) {
    return {
      status: "success" as const,
      valid: true,
      evaluatedStateVersion: state.stateVersion,
      simulationTimeMs: state.simulationTimeMs,
      ...(effectiveAtSimulationTimeMs !== state.simulationTimeMs
        ? { projectedSimulationTimeMs: effectiveAtSimulationTimeMs }
        : {}),
      affectedAircraft,
      conflicts,
      constraints,
      classification,
      nextAction: "continue" as const,
    };
  }

  return {
    status: "refusal" as const,
    valid: false,
    evaluatedStateVersion: state.stateVersion,
    simulationTimeMs: state.simulationTimeMs,
    ...(effectiveAtSimulationTimeMs !== state.simulationTimeMs
      ? { projectedSimulationTimeMs: effectiveAtSimulationTimeMs }
      : {}),
    affectedAircraft,
    conflicts,
    constraints,
    classification,
    ...(mustIssueBy.length > 0
      ? { mustIssueBySimulationTimeMs: Math.min(...mustIssueBy) }
      : {}),
    nextAction:
      conflicts.length > 0
        ? ("wait-for-runway-resource" as const)
        : constraints.some(({ kind }) => kind === "wake-separation")
          ? ("delay-for-wake-separation" as const)
          : ("select-suitable-runway" as const),
  };
}

type TrafficEvent =
  | { kind: "aircraft-state-transition"; callsign: string }
  | {
      kind: "pilot-go-around-executed";
      aircraftId: string;
      callsign: string;
      summary: string;
    };

function capabilityProfileFor(state: ApplicationState, aircraft: Aircraft) {
  const profile = state.aircraftCapabilityProfiles.find(
    ({ id }) => id === aircraft.capabilityProfileId,
  );
  if (!profile) {
    throw new Error(`Unknown capability profile for ${aircraft.id}.`);
  }
  return profile;
}

function runwayBlockedForLanding(
  state: ApplicationState,
  runwayId: "09-27" | "04-22",
  landingAircraftId: string,
) {
  return state.runwayOccupancies.some(
    (occupancy) =>
      occupancy.aircraftId !== landingAircraftId &&
      occupancy.beganAtSimulationTimeMs <= state.simulationTimeMs &&
      occupancy.clearsAtSimulationTimeMs > state.simulationTimeMs &&
      (occupancy.runwayId === runwayId ||
        state.airport.intersections.some(
          ({ runwayIds }) =>
            runwayIds.includes(runwayId) &&
            runwayIds.includes(occupancy.runwayId),
        )),
  );
}

function moveTowardsWaypoints(
  aircraft: Aircraft,
  progress: AircraftProgress,
  distanceNm: number,
): { position: MapPoint; headingDegrees: number; arrived: boolean } {
  let position = { ...aircraft.position };
  let headingDegrees = aircraft.headingDegrees;
  let remainingNm = distanceNm;
  while (remainingNm > 0 && progress.waypointIndex < progress.waypoints.length) {
    const target = progress.waypoints[progress.waypointIndex];
    const legDistanceNm = distanceBetween(position, target);
    if (legDistanceNm <= remainingNm) {
      position = { ...target };
      progress.waypointIndex += 1;
      remainingNm -= legDistanceNm;
      continue;
    }
    headingDegrees = headingTowards(position, target);
    const direction = headingUnitVector(headingDegrees);
    position = addScaled(position, direction, remainingNm);
    remainingNm = 0;
  }
  if (progress.waypointIndex < progress.waypoints.length) {
    headingDegrees = headingTowards(
      position,
      progress.waypoints[progress.waypointIndex],
    );
  }
  return {
    position,
    headingDegrees,
    arrived: progress.waypointIndex >= progress.waypoints.length,
  };
}

function beginGoAround(
  state: ApplicationState,
  aircraft: Aircraft,
  progress: AircraftProgress,
) {
  progress.stage = "go-around";
  progress.waypoints = missedApproachWaypoints(
    state.airport,
    progress.runwayId,
    progress.runwayEnd,
  );
  progress.waypointIndex = 0;
  progress.stageStartedAtMs = state.simulationTimeMs;
  progress.approachAttempts += 1;
  delete progress.forcedGoAroundOnNextGate;
}

type DeckEvent = {
  action: "emergency-declared" | "takeoff-rejected";
  summary: string;
};

function currentRunwayConflictCount(state: ApplicationState) {
  const activeOccupancies = state.runwayOccupancies.filter(
    (occupancy) =>
      occupancy.beganAtSimulationTimeMs <= state.simulationTimeMs &&
      occupancy.clearsAtSimulationTimeMs > state.simulationTimeMs,
  );
  let conflictCount = 0;
  for (let first = 0; first < activeOccupancies.length; first += 1) {
    for (
      let second = first + 1;
      second < activeOccupancies.length;
      second += 1
    ) {
      const sameRunway =
        activeOccupancies[first].runwayId === activeOccupancies[second].runwayId;
      const sharedIntersection = state.airport.intersections.some(
        ({ runwayIds }) =>
          runwayIds.includes(activeOccupancies[first].runwayId) &&
          runwayIds.includes(activeOccupancies[second].runwayId),
      );
      if (sameRunway || sharedIntersection) {
        conflictCount += 1;
      }
    }
  }
  return conflictCount;
}

function trafficDisrupted(state: ApplicationState) {
  return Object.values(state.aircraftProgress).some(
    ({ stage }) => stage === "go-around" || stage === "rejected",
  );
}

function limitationUnableReason(
  state: ApplicationState,
  aircraftId: string,
  instructionKind: RunwayClearanceKind | "tactical-instruction",
) {
  const limitation = state.eventDeck.temporaryLimitation;
  if (limitation.status !== "active" || limitation.aircraftId !== aircraftId) {
    return undefined;
  }
  if (
    instructionKind !== "tactical-instruction" &&
    instructionKind !== "clear-to-land"
  ) {
    return undefined;
  }
  return limitation.reason;
}

function rejectionRecoveryApproved(state: ApplicationState) {
  const rejectedAt =
    state.eventDeck.rejectedTakeoff.rejectedAtSimulationTimeMs;
  if (rejectedAt === undefined) {
    return false;
  }
  return state.operationalReceipts.some(
    (receipt) =>
      receipt.action === "recovery-plan-approved-and-dispatched" &&
      receipt.simulationTimeMs >= rejectedAt,
  );
}

function arrivalAlignedForForcedGoAround(state: ApplicationState) {
  return state.aircraft.some((aircraft) => {
    const progress = state.aircraftProgress[aircraft.id];
    if (
      !progress ||
      progress.role !== "arrival" ||
      aircraft.flightPhase === "out-of-play" ||
      (progress.stage !== "inbound" && progress.stage !== "approach")
    ) {
      return false;
    }
    const threshold = runwayThreshold(
      state.airport,
      progress.runwayId,
      progress.runwayEnd,
    );
    const distanceNm = Math.max(
      0,
      distanceBetween(aircraft.position, threshold) - LANDING_DECISION_GATE_NM,
    );
    const speedKnots = Math.max(aircraft.speedKnots, 60);
    return (distanceNm / speedKnots) * 3_600_000 <= 65_000;
  });
}

function recoverySubstantiallyUnderway(state: ApplicationState) {
  const emergency = state.eventDeck.emergency;
  if (emergency.status !== "resolved") {
    return false;
  }
  if (
    state.operationalReceipts.some(
      (receipt) =>
        receipt.action === "recovery-plan-approved-and-dispatched" &&
        receipt.simulationTimeMs >= emergency.declareAtSimulationTimeMs,
    )
  ) {
    return true;
  }
  const resolvedAt =
    emergency.resolvedAtSimulationTimeMs ?? Number.POSITIVE_INFINITY;
  return (
    state.simulationTimeMs - resolvedAt >= EVENT_SPACING_QUIET_PERIOD_MS &&
    !trafficDisrupted(state) &&
    currentRunwayConflictCount(state) === 0
  );
}

function runEventDeck(state: ApplicationState): DeckEvent[] {
  const events: DeckEvent[] = [];
  const deck = state.eventDeck;

  const emergencyAircraft = state.aircraft.find(
    ({ id }) => id === deck.emergency.aircraftId,
  );
  if (
    deck.emergency.status === "pending" &&
    state.simulationTimeMs >= deck.emergency.declareAtSimulationTimeMs
  ) {
    if (!emergencyAircraft || emergencyAircraft.flightPhase === "out-of-play") {
      deck.emergency.status = "resolved";
      deck.emergency.resolvedAtSimulationTimeMs = state.simulationTimeMs;
    } else {
      deck.emergency.status = "declared";
      appendTransmission(
        state,
        "pilot",
        emergencyAircraft.id,
        `MAYDAY, MAYDAY, MAYDAY, ${emergencyAircraft.callsign}, engine failure, requesting immediate landing.`,
      );
      events.push({
        action: "emergency-declared",
        summary: `${emergencyAircraft.callsign} declared an emergency inbound and requires priority handling.`,
      });
    }
  } else if (
    deck.emergency.status === "declared" &&
    emergencyAircraft?.flightPhase === "out-of-play"
  ) {
    deck.emergency.status = "resolved";
    deck.emergency.resolvedAtSimulationTimeMs = state.simulationTimeMs;
  }

  if (
    deck.rejectedTakeoff.status === "pending" &&
    recoverySubstantiallyUnderway(state)
  ) {
    deck.rejectedTakeoff.status = "armed";
  }
  if (deck.rejectedTakeoff.status === "armed") {
    // The rejection retargets to whichever departure is rolling once an
    // eligible arrival will reach its decision gate during the extended
    // occupancy; an unaligned roll departs normally and the event stays armed.
    const rollingDeparture = state.aircraft.find((aircraft) => {
      const progress = state.aircraftProgress[aircraft.id];
      return (
        progress?.role === "departure" &&
        progress.stage === "takeoff-roll" &&
        state.simulationTimeMs - progress.stageStartedAtMs >=
          deck.rejectedTakeoff.rejectAfterRollMs
      );
    });
    if (rollingDeparture && arrivalAlignedForForcedGoAround(state)) {
      const rollingProgress = state.aircraftProgress[rollingDeparture.id];
      deck.rejectedTakeoff.aircraftId = rollingDeparture.id;
      deck.rejectedTakeoff.status = "rejected";
      deck.rejectedTakeoff.rejectedAtSimulationTimeMs = state.simulationTimeMs;
      rollingProgress.stage = "rejected";
      rollingProgress.stageStartedAtMs = state.simulationTimeMs;
      for (const occupancy of state.runwayOccupancies) {
        if (
          occupancy.aircraftId === rollingDeparture.id &&
          occupancy.clearsAtSimulationTimeMs > state.simulationTimeMs
        ) {
          occupancy.clearsAtSimulationTimeMs =
            state.simulationTimeMs + REJECTED_TAKEOFF_OCCUPANCY_MS;
        }
      }
      state.aircraft = state.aircraft.map((aircraft) =>
        aircraft.id === rollingDeparture.id
          ? { ...aircraft, activeRunwayClearance: undefined }
          : aircraft,
      );
      appendTransmission(
        state,
        "pilot",
        rollingDeparture.id,
        `${rollingDeparture.callsign}, rejecting takeoff.`,
      );
      events.push({
        action: "takeoff-rejected",
        summary: `${rollingDeparture.callsign} rejected takeoff; runway ${rollingProgress.runwayId} remains occupied and recovery requires an approved Recovery Plan.`,
      });
    }
  } else if (deck.rejectedTakeoff.status === "rejected") {
    const rejectedAircraft = state.aircraft.find(
      ({ id }) => id === deck.rejectedTakeoff.aircraftId,
    );
    if (
      rejectedAircraft?.exit === "departed" &&
      rejectionRecoveryApproved(state)
    ) {
      deck.rejectedTakeoff.status = "resolved";
    }
  }

  if (deck.independentGoAround.status === "executed") {
    const independentAircraft = state.aircraft.find(
      ({ id }) => id === deck.independentGoAround.aircraftId,
    );
    if (independentAircraft?.flightPhase === "out-of-play") {
      deck.independentGoAround.status = "resolved";
    }
  }

  const limitation = deck.temporaryLimitation;
  if (
    limitation.status !== "expired" &&
    state.simulationTimeMs >= limitation.activeUntilSimulationTimeMs
  ) {
    limitation.status = "expired";
  } else if (
    limitation.status === "pending" &&
    state.simulationTimeMs >= limitation.activeFromSimulationTimeMs
  ) {
    limitation.status = "active";
  }

  return events;
}

function allDeckEventsResolved(state: ApplicationState) {
  const deck = state.eventDeck;
  return (
    deck.emergency.status === "resolved" &&
    deck.rejectedTakeoff.status === "resolved" &&
    deck.independentGoAround.status === "resolved" &&
    deck.temporaryLimitation.status === "reported"
  );
}

function stableFlowNow(state: ApplicationState) {
  return (
    !state.stagedRecoveryPlan &&
    !trafficDisrupted(state) &&
    currentRunwayConflictCount(state) === 0
  );
}

function advanceTraffic(state: ApplicationState, deltaMs: number) {
  const events: TrafficEvent[] = [];

  state.aircraft = state.aircraft.map((aircraft) => {
    const progress = state.aircraftProgress[aircraft.id];
    if (
      !progress ||
      aircraft.flightPhase === "out-of-play" ||
      progress.stage === "done"
    ) {
      return aircraft;
    }
    const profile = capabilityProfileFor(state, aircraft);
    const transition = () =>
      events.push({
        kind: "aircraft-state-transition",
        callsign: aircraft.callsign,
      });
    let next: Aircraft = aircraft;

    if (progress.stage === "waiting") {
      if (state.simulationTimeMs < progress.entersPlayAtMs) {
        return aircraft;
      }
      if (progress.role === "arrival") {
        progress.stage = "inbound";
        progress.waypoints = [
          finalApproachFix(state.airport, progress.runwayId, progress.runwayEnd),
        ];
        progress.waypointIndex = 0;
        transition();
        return { ...aircraft, pilotState: "monitoring" };
      }
      progress.stage = "circuit";
      progress.waypoints = circuitEntryWaypoints(
        state.airport,
        progress.runwayId,
        progress.runwayEnd,
      );
      progress.waypointIndex = 0;
      return aircraft;
    }

    if (progress.stage === "circuit") {
      const clearance = aircraft.activeRunwayClearance;
      const restartLap = () => {
        progress.waypoints = circuitLoopWaypoints(
          state.airport,
          progress.runwayId,
          progress.runwayEnd,
        );
        progress.waypointIndex = 0;
        delete progress.lapDecision;
      };
      if (clearance?.kind === "go-around") {
        restartLap();
        return { ...next, activeRunwayClearance: undefined };
      }
      const onFinalLeg =
        progress.waypointIndex === progress.waypoints.length - 1;
      if (onFinalLeg && !progress.lapDecision) {
        const runwayFree = !runwayBlockedForLanding(
          state,
          progress.runwayId,
          aircraft.id,
        );
        if (
          clearance?.kind === "clear-touch-and-go" &&
          clearance.runwayId === progress.runwayId &&
          runwayFree
        ) {
          progress.lapDecision = "touch-and-go";
        } else if (
          clearance?.kind === "clear-to-land" &&
          clearance.runwayId === progress.runwayId &&
          runwayFree
        ) {
          progress.lapDecision = "full-stop";
        } else {
          restartLap();
          return next;
        }
      }
      const moved = moveTowardsWaypoints(
        aircraft,
        progress,
        (aircraft.speedKnots / 3_600_000) * deltaMs,
      );
      const circuitAltitudeFeet = circuitDefinitionFor(
        state.airport,
        progress.runwayId,
        progress.runwayEnd,
      ).altitudeFeetAgl;
      const threshold =
        progress.waypoints[progress.waypoints.length - 1] ??
        runwayThreshold(state.airport, progress.runwayId, progress.runwayEnd);
      const altitudeFeet =
        onFinalLeg && progress.lapDecision !== "extend"
          ? Math.max(
              0,
              Math.min(
                circuitAltitudeFeet,
                Math.round(distanceBetween(moved.position, threshold) * 800),
              ),
            )
          : circuitAltitudeFeet;
      if (moved.arrived && progress.lapDecision === "touch-and-go") {
        state.runwayOccupancies.push({
          runwayId: progress.runwayId,
          aircraftId: aircraft.id,
          callsign: aircraft.callsign,
          operation: "arrival",
          wakeCategory: profile.wakeCategory,
          beganAtSimulationTimeMs: state.simulationTimeMs,
          clearsAtSimulationTimeMs:
            state.simulationTimeMs + TOUCH_AND_GO_OCCUPANCY_MS,
        });
        restartLap();
        return {
          ...next,
          position: moved.position,
          altitudeFeet: 0,
          activeRunwayClearance: undefined,
        };
      }
      if (moved.arrived && progress.lapDecision === "full-stop") {
        state.runwayOccupancies.push({
          runwayId: progress.runwayId,
          aircraftId: aircraft.id,
          callsign: aircraft.callsign,
          operation: "arrival",
          wakeCategory: profile.wakeCategory,
          beganAtSimulationTimeMs: state.simulationTimeMs,
          clearsAtSimulationTimeMs:
            state.simulationTimeMs + ARRIVAL_OCCUPANCY_MS,
        });
        progress.stage = "rollout";
        progress.stageStartedAtMs = state.simulationTimeMs;
        return {
          ...next,
          position: moved.position,
          altitudeFeet: 0,
          speedKnots: 40,
        };
      }
      if (moved.arrived) {
        restartLap();
        return { ...next, position: moved.position, altitudeFeet };
      }
      return {
        ...next,
        position: moved.position,
        headingDegrees: moved.headingDegrees,
        trackDegrees: moved.headingDegrees,
        altitudeFeet,
      };
    }

    if (progress.stage === "hold-short" || progress.stage === "lined-up") {
      const clearance = aircraft.activeRunwayClearance;
      if (
        !clearance ||
        clearance.runwayId !== progress.runwayId ||
        aircraft.pilotState !== "operating"
      ) {
        return aircraft;
      }
      if (clearance.kind === "clear-for-takeoff") {
        const existingOccupancy = state.runwayOccupancies.find(
          (occupancy) =>
            occupancy.aircraftId === aircraft.id &&
            occupancy.clearsAtSimulationTimeMs > state.simulationTimeMs,
        );
        if (existingOccupancy) {
          existingOccupancy.clearsAtSimulationTimeMs =
            state.simulationTimeMs + DEPARTURE_OCCUPANCY_MS;
        } else {
          state.runwayOccupancies.push({
            runwayId: progress.runwayId,
            aircraftId: aircraft.id,
            callsign: aircraft.callsign,
            operation: "departure",
            wakeCategory: profile.wakeCategory,
            beganAtSimulationTimeMs: state.simulationTimeMs,
            clearsAtSimulationTimeMs:
              state.simulationTimeMs + DEPARTURE_OCCUPANCY_MS,
          });
        }
        progress.stage = "takeoff-roll";
        progress.stageStartedAtMs = state.simulationTimeMs;
        transition();
        return { ...next, flightPhase: "departure" };
      }
      if (
        clearance.kind === "line-up-and-wait" &&
        progress.stage === "hold-short"
      ) {
        state.runwayOccupancies.push({
          runwayId: progress.runwayId,
          aircraftId: aircraft.id,
          callsign: aircraft.callsign,
          operation: "departure",
          wakeCategory: profile.wakeCategory,
          beganAtSimulationTimeMs: state.simulationTimeMs,
          clearsAtSimulationTimeMs:
            state.simulationTimeMs + LINE_UP_OCCUPANCY_MS,
        });
        progress.stage = "lined-up";
        progress.stageStartedAtMs = state.simulationTimeMs;
        return next;
      }
      if (
        clearance.kind === "cancel-runway-clearance" &&
        progress.stage === "lined-up"
      ) {
        for (const occupancy of state.runwayOccupancies) {
          if (
            occupancy.aircraftId === aircraft.id &&
            occupancy.clearsAtSimulationTimeMs > state.simulationTimeMs
          ) {
            occupancy.clearsAtSimulationTimeMs = state.simulationTimeMs;
          }
        }
        progress.stage = "hold-short";
        return { ...next, activeRunwayClearance: undefined };
      }
      return aircraft;
    }

    if (progress.stage === "takeoff-roll") {
      const elapsedMs = state.simulationTimeMs - progress.stageStartedAtMs;
      const liftoffSpeedKnots = Math.round(profile.approachSpeedKnots * 1.1);
      const rollFraction = Math.min(1, elapsedMs / TAKEOFF_ROLL_DURATION_MS);
      const speedKnots = Math.round(liftoffSpeedKnots * rollFraction);
      const direction = headingUnitVector(
        runwayEndHeadingDegrees(progress.runwayEnd),
      );
      const position = addScaled(
        aircraft.position,
        direction,
        (speedKnots / 3_600_000) * deltaMs,
      );
      if (elapsedMs >= TAKEOFF_ROLL_DURATION_MS) {
        progress.stage = "climb-out";
        progress.stageStartedAtMs = state.simulationTimeMs;
      }
      return {
        ...next,
        position,
        speedKnots,
        headingDegrees: runwayEndHeadingDegrees(progress.runwayEnd),
        trackDegrees: runwayEndHeadingDegrees(progress.runwayEnd),
      };
    }

    if (progress.stage === "rejected") {
      if (
        state.simulationTimeMs - progress.stageStartedAtMs >=
        REJECTED_TAKEOFF_OCCUPANCY_MS
      ) {
        progress.stage = "hold-short";
        transition();
        // A Clearance dispatched during the stop (an approved Recovery Plan)
        // survives; only the rejected takeoff Clearance was consumed.
        return {
          ...next,
          speedKnots: 0,
          flightPhase: "hold-short",
          pilotState:
            aircraft.pilotState === "operating" && aircraft.activeRunwayClearance
              ? "operating"
              : "ready",
        };
      }
      return {
        ...next,
        speedKnots: Math.max(
          0,
          aircraft.speedKnots - Math.round(deltaMs / 100) * 2,
        ),
      };
    }

    if (progress.stage === "climb-out") {
      const direction = headingUnitVector(
        runwayEndHeadingDegrees(progress.runwayEnd),
      );
      const speedKnots = profile.cruiseSpeedKnots;
      const position = addScaled(
        aircraft.position,
        direction,
        (speedKnots / 3_600_000) * deltaMs,
      );
      const altitudeFeet = Math.round(
        aircraft.altitudeFeet +
          (profile.climbRateFeetPerMinute / 60_000) * deltaMs,
      );
      const boundary = state.airport.localControlBoundary;
      if (
        distanceBetween(position, boundary.center) >
        boundary.radiusNauticalMiles
      ) {
        progress.stage = "done";
        transition();
        return {
          ...next,
          position,
          speedKnots,
          altitudeFeet,
          flightPhase: "out-of-play",
          pilotState: "complete",
          exit: "departed",
        };
      }
      return { ...next, position, speedKnots, altitudeFeet };
    }

    if (progress.stage === "inbound" || progress.stage === "go-around") {
      const clearance = aircraft.activeRunwayClearance;
      if (clearance?.kind === "go-around" && progress.stage === "inbound") {
        beginGoAround(state, aircraft, progress);
        return { ...next, activeRunwayClearance: undefined };
      }
      const speedKnots =
        progress.stage === "go-around"
          ? Math.max(
              profile.approachSpeedKnots,
              Math.min(profile.cruiseSpeedKnots, 160),
            )
          : aircraft.speedKnots;
      const moved = moveTowardsWaypoints(
        aircraft,
        progress,
        (speedKnots / 3_600_000) * deltaMs,
      );
      const altitudeFeet =
        progress.stage === "go-around"
          ? Math.min(
              1_000,
              Math.round(
                aircraft.altitudeFeet +
                  (profile.climbRateFeetPerMinute / 60_000) * deltaMs,
              ),
            )
          : aircraft.altitudeFeet;
      if (moved.arrived) {
        progress.stage = "approach";
        progress.waypoints = [
          runwayThreshold(state.airport, progress.runwayId, progress.runwayEnd),
        ];
        progress.waypointIndex = 0;
        delete progress.committedToLand;
        transition();
        return {
          ...next,
          position: moved.position,
          headingDegrees: moved.headingDegrees,
          trackDegrees: moved.headingDegrees,
          speedKnots: profile.approachSpeedKnots,
          altitudeFeet: Math.min(altitudeFeet, 1_500),
          flightPhase: "approach",
          pilotState:
            aircraft.pilotState === "monitoring"
              ? "operating"
              : aircraft.pilotState,
        };
      }
      return {
        ...next,
        position: moved.position,
        headingDegrees: moved.headingDegrees,
        trackDegrees: moved.headingDegrees,
        speedKnots,
        altitudeFeet,
      };
    }

    if (progress.stage === "approach") {
      const clearance = aircraft.activeRunwayClearance;
      if (clearance?.kind === "go-around") {
        beginGoAround(state, aircraft, progress);
        return { ...next, activeRunwayClearance: undefined };
      }
      if (clearance?.kind === "cancel-runway-clearance") {
        return { ...next, activeRunwayClearance: undefined };
      }
      const threshold = runwayThreshold(
        state.airport,
        progress.runwayId,
        progress.runwayEnd,
      );
      const distanceToThresholdNm = distanceBetween(
        aircraft.position,
        threshold,
      );
      if (
        distanceToThresholdNm <= LANDING_DECISION_GATE_NM &&
        !progress.committedToLand
      ) {
        const clearedToLand =
          clearance?.kind === "clear-to-land" &&
          clearance.runwayId === progress.runwayId;
        const independentGoAround = state.eventDeck.independentGoAround;
        const forcedUnstableApproach =
          independentGoAround.status === "pending" &&
          independentGoAround.aircraftId === aircraft.id;
        if (
          forcedUnstableApproach ||
          progress.forcedGoAroundOnNextGate ||
          !clearedToLand ||
          runwayBlockedForLanding(state, progress.runwayId, aircraft.id)
        ) {
          const reason = forcedUnstableApproach
            ? "unstable approach"
            : !clearedToLand
              ? "no landing clearance"
              : "runway occupied";
          if (forcedUnstableApproach) {
            independentGoAround.status = "executed";
          }
          beginGoAround(state, aircraft, progress);
          appendTransmission(
            state,
            "pilot",
            aircraft.id,
            `${aircraft.callsign}, going around, ${reason}.`,
          );
          events.push({
            kind: "pilot-go-around-executed",
            aircraftId: aircraft.id,
            callsign: aircraft.callsign,
            summary: `${aircraft.callsign} executed a Pilot-owned go-around (${reason}) on runway ${progress.runwayEnd}.`,
          });
          return { ...next, activeRunwayClearance: undefined };
        }
        progress.committedToLand = true;
      }
      const moved = moveTowardsWaypoints(
        aircraft,
        progress,
        (aircraft.speedKnots / 3_600_000) * deltaMs,
      );
      const altitudeFeet = Math.max(
        0,
        Math.round(
          (distanceBetween(moved.position, threshold) /
            FINAL_APPROACH_FIX_DISTANCE_NM) *
            1_500,
        ),
      );
      if (moved.arrived) {
        state.runwayOccupancies.push({
          runwayId: progress.runwayId,
          aircraftId: aircraft.id,
          callsign: aircraft.callsign,
          operation: "arrival",
          wakeCategory: profile.wakeCategory,
          beganAtSimulationTimeMs: state.simulationTimeMs,
          clearsAtSimulationTimeMs:
            state.simulationTimeMs + ARRIVAL_OCCUPANCY_MS,
        });
        progress.stage = "rollout";
        progress.stageStartedAtMs = state.simulationTimeMs;
        return {
          ...next,
          position: moved.position,
          altitudeFeet: 0,
          speedKnots: 40,
        };
      }
      return {
        ...next,
        position: moved.position,
        headingDegrees: moved.headingDegrees,
        trackDegrees: moved.headingDegrees,
        altitudeFeet,
      };
    }

    if (progress.stage === "rollout") {
      if (
        state.simulationTimeMs - progress.stageStartedAtMs >=
        ARRIVAL_OCCUPANCY_MS
      ) {
        progress.stage = "done";
        transition();
        return {
          ...next,
          speedKnots: 0,
          flightPhase: "out-of-play",
          pilotState: "complete",
          exit: "landed",
        };
      }
      return aircraft;
    }

    return aircraft;
  });

  return events;
}

function activeCapabilities(
  posture: OperatingPosture,
  categoryOverrides: Partial<Record<ActionCategory, CategoryOverride>>,
): Capability[] {
  if (posture === "observe") {
    return [...OBSERVE_CAPABILITIES];
  }

  const capabilities: Capability[] = [
    ...OBSERVE_CAPABILITIES,
    "stage_clearance_plan",
    "stage_recovery_plan",
  ];

  if (posture === "take-the-sector") {
    if (categoryOverrides["runway-clearance"] !== "withheld") {
      capabilities.push("issue_runway_clearance");
    }
    if (categoryOverrides["tactical-instruction"] !== "withheld") {
      capabilities.push("issue_tactical_instruction");
    }
  }

  return capabilities;
}

export function createFlowControlApplication(options: {
  scenarioSeed: string;
  controllerScreenName?: string;
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
    categoryOverrides: {},
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
      controllerScreenName: state.controllerScreenName,
      weather: { ...state.weather },
      airport: structuredClone(state.airport),
      aircraftCapabilityProfiles: structuredClone(state.aircraftCapabilityProfiles),
      aircraft: structuredClone(state.aircraft),
      runwayResources: structuredClone(state.runwayResources),
      transmissions: structuredClone(state.transmissions),
      operatingPosture: state.operatingPosture,
      categoryOverrides: structuredClone(state.categoryOverrides),
      simulationTimeMs: state.simulationTimeMs,
      stateVersion: state.stateVersion,
      eventCursor: monitoringReceipts(state.operationalReceipts).length,
      pendingOperatingPosture: state.pendingOperatingPosture,
      capabilitySynchronization: state.capabilitySynchronization,
      stagedClearancePlanReference: state.stagedClearancePlanReference,
      stagedClearancePlan: structuredClone(state.stagedClearancePlan),
      stagedRecoveryPlan: structuredClone(state.stagedRecoveryPlan),
      selectedAircraftId: state.selectedAircraftId,
    };
  }

  function selectedTowerSnapshot(
    sections: TowerSnapshotSection[],
    detail: TowerSnapshotDetail,
  ) {
    const snapshot = towerSnapshot();
    const selected = new Set(sections);
    return {
      shiftStatus: snapshot.shiftStatus,
      scenarioSeed: snapshot.scenarioSeed,
      stateVersion: snapshot.stateVersion,
      eventCursor: snapshot.eventCursor,
      simulationTimeMs: snapshot.simulationTimeMs,
      selectedAircraftId: snapshot.selectedAircraftId,
      ...(selected.has("authority")
        ? {
            authority: {
              operatingPosture: snapshot.operatingPosture,
              categoryOverrides: snapshot.categoryOverrides,
              ...(snapshot.pendingOperatingPosture
                ? { pendingOperatingPosture: snapshot.pendingOperatingPosture }
                : {}),
              ...(snapshot.capabilitySynchronization
                ? {
                    capabilitySynchronization:
                      snapshot.capabilitySynchronization,
                  }
                : {}),
              ...(detail === "full" && snapshot.controllerScreenName
                ? { controllerScreenName: snapshot.controllerScreenName }
                : {}),
            },
          }
        : {}),
      ...(selected.has("weather") ? { weather: snapshot.weather } : {}),
      ...(selected.has("runways")
        ? {
            runways: {
              airport:
                detail === "full"
                  ? snapshot.airport
                  : {
                      id: snapshot.airport.id,
                      name: snapshot.airport.name,
                      runways: snapshot.airport.runways.map(
                        ({ id, role, runwayEnds }) => ({
                          id,
                          role,
                          runwayEnds: [...runwayEnds],
                        }),
                      ),
                      intersections: snapshot.airport.intersections.map(
                        ({ id, runwayIds }) => ({
                          id,
                          runwayIds: [...runwayIds],
                        }),
                      ),
                    },
              resources: snapshot.runwayResources,
            },
          }
        : {}),
      ...(selected.has("traffic")
        ? {
            traffic: {
              aircraft: snapshot.aircraft,
              ...(detail === "full"
                ? {
                    aircraftCapabilityProfiles:
                      snapshot.aircraftCapabilityProfiles,
                  }
                : {}),
            },
          }
        : {}),
      ...(selected.has("plans")
        ? {
            plans: {
              clearancePlan: snapshot.stagedClearancePlan,
              recoveryPlan: snapshot.stagedRecoveryPlan,
            },
          }
        : {}),
      ...(selected.has("transmissions")
        ? {
            transmissions:
              detail === "full"
                ? snapshot.transmissions
                : snapshot.transmissions.slice(-5),
          }
        : {}),
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

  const OPERATIONAL_MUTATION_COMMANDS = new Set<Command["type"]>([
    "begin-shift",
    "reduce-operating-posture",
    "request-operating-posture-increase",
    "confirm-operating-posture-increase",
    "set-category-override",
    "stage-clearance-plan",
    "stage-recovery-plan",
    "set-clearance-plan-member-selection",
    "dispatch-selected-clearance-plan",
    "select-clearance-plan-alternative",
    "edit-clearance-plan-tactical-instruction",
    "approve-recovery-plan",
    "issue-runway-clearance",
    "issue-tactical-instruction",
  ]);

  return {
    command(command: Command) {
      if (
        (state.shiftStatus === "completed" ||
          state.shiftStatus === "incomplete") &&
        OPERATIONAL_MUTATION_COMMANDS.has(command.type)
      ) {
        return {
          status: "refusal" as const,
          stateVersion: state.stateVersion,
          summary: "The Shift is complete; operational state is read-only.",
          rationale:
            "Completed Shifts accept no further operational mutations; review the Shift Scorecard and export the audit.",
          nextAction: "get_tower_snapshot" as const,
        };
      }

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

      if (command.type === "record-webmcp-tool-execution") {
        state.operationalReceipts.push({
          actor: command.actor,
          action: "webmcp-tool-executed",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore: command.stateVersionBefore,
          stateVersionAfter: state.stateVersion,
          summary:
            typeof command.result.summary === "string"
              ? `${command.capability}: ${command.result.summary}`
              : `${command.capability} execution recorded.`,
          webMcp: {
            capability: command.capability,
            input: structuredClone(command.input),
            result: structuredClone(command.result),
            actor: command.actor,
            authority: {
              operatingPosture: state.operatingPosture,
              categoryOverrides: structuredClone(state.categoryOverrides),
            },
            startedAtWallClockMs: command.startedAtWallClockMs,
            durationMs: command.durationMs,
          },
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));
        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `${command.capability} execution recorded.`,
          nextAction: "continue" as const,
        };
      }

      if (command.type === "select-aircraft") {
        const aircraft = state.aircraft.find(
          ({ id, flightPhase }) =>
            id === command.aircraftId && flightPhase !== "out-of-play",
        );
        if (!aircraft) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: `Aircraft ${command.aircraftId} is not available for selection.`,
            nextAction: "get_tower_snapshot" as const,
          };
        }

        state.selectedAircraftId = aircraft.id;
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));
        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `${aircraft.callsign} selected by the Supervising Controller.`,
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
          if (state.shiftStatus !== "active") {
            break;
          }
          const deltaMs =
            simulation.fixedTimeStepMs * simulation.paceMultiplier;
          state.simulationTimeMs += deltaMs;
          for (const deckEvent of runEventDeck(state)) {
            const stateVersionBefore = state.stateVersion;
            state.stateVersion += 1;
            state.operationalReceipts.push({
              actor: "simulation-clock",
              action: deckEvent.action,
              simulationTimeMs: state.simulationTimeMs,
              stateVersionBefore,
              stateVersionAfter: state.stateVersion,
              summary: deckEvent.summary,
            });
            for (const action of invalidateStagedPlans(state)) {
              const invalidationVersionBefore = state.stateVersion;
              state.stateVersion += 1;
              state.operationalReceipts.push({
                actor: "simulation-clock",
                action,
                simulationTimeMs: state.simulationTimeMs,
                stateVersionBefore: invalidationVersionBefore,
                stateVersionAfter: state.stateVersion,
              });
            }
          }
          for (const trafficEvent of advanceTraffic(state, deltaMs)) {
            const stateVersionBefore = state.stateVersion;
            state.stateVersion += 1;
            state.operationalReceipts.push({
              actor: command.actor,
              action: trafficEvent.kind,
              simulationTimeMs: state.simulationTimeMs,
              stateVersionBefore,
              stateVersionAfter: state.stateVersion,
              ...(trafficEvent.kind === "pilot-go-around-executed"
                ? { summary: trafficEvent.summary }
                : {}),
            });
            if (trafficEvent.kind === "pilot-go-around-executed") {
              for (const action of invalidateStagedPlans(state)) {
                const invalidationVersionBefore = state.stateVersion;
                state.stateVersion += 1;
                state.operationalReceipts.push({
                  actor: "simulation-clock",
                  action,
                  simulationTimeMs: state.simulationTimeMs,
                  stateVersionBefore: invalidationVersionBefore,
                  stateVersionAfter: state.stateVersion,
                });
              }
            }
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
              action:
                readback.kind === "unable"
                  ? "pilot-unable-reported"
                  : "pilot-readback-received",
              simulationTimeMs: state.simulationTimeMs,
              stateVersionBefore,
              stateVersionAfter: state.stateVersion,
              ...(readback.kind === "unable"
                ? {
                    summary: `Pilot reported unable; replan this aircraft: ${readback.text}`,
                  }
                : {}),
            });
          }
          for (const action of expireStagedPlans(state)) {
            const stateVersionBefore = state.stateVersion;
            state.stateVersion += 1;
            state.operationalReceipts.push({
              actor: "simulation-clock",
              action,
              simulationTimeMs: state.simulationTimeMs,
              stateVersionBefore,
              stateVersionAfter: state.stateVersion,
            });
          }
          if (allDeckEventsResolved(state) && stableFlowNow(state)) {
            state.stableSinceSimulationTimeMs ??= state.simulationTimeMs;
            if (
              state.simulationTimeMs - state.stableSinceSimulationTimeMs >=
              STABLE_FLOW_HOLD_MS
            ) {
              for (const action of [
                "stable-flow-restored",
                "shift-completed",
              ] as const) {
                const stateVersionBefore = state.stateVersion;
                state.stateVersion += 1;
                state.operationalReceipts.push({
                  actor: "simulation-clock",
                  action,
                  simulationTimeMs: state.simulationTimeMs,
                  stateVersionBefore,
                  stateVersionAfter: state.stateVersion,
                  summary:
                    action === "stable-flow-restored"
                      ? "Stable Flow restored after all required events were resolved."
                      : "The Shift is complete; review the Shift Scorecard and audit export.",
                });
              }
              state.shiftStatus = "completed";
            }
          } else {
            delete state.stableSinceSimulationTimeMs;
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
          summary: staleCommandSummary(command.type),
          rationale: `Expected State Version ${command.expectedStateVersion}; current State Version is ${state.stateVersion}.`,
          nextAction: "get_tower_snapshot" as const,
        };
      }

      if (command.type === "set-category-override") {
        state.categoryOverrides = {
          ...state.categoryOverrides,
          [command.category]: command.disposition,
        };
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "category-override-updated",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `${command.category} is ${command.disposition} for the Tower Agent.`,
          nextAction: "wait-for-tower-event" as const,
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
        if (
          command.actor === "tower-agent" &&
          state.categoryOverrides["runway-clearance"] === "withheld"
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Runway Clearance is withheld by Category Override.",
            rationale:
              "The Supervising Controller withheld runway Clearance dispatch from the Tower Agent.",
            nextAction: "wait-for-tower-event" as const,
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

        if (
          command.actor === "tower-agent" &&
          state.eventDeck.rejectedTakeoff.status === "rejected" &&
          command.aircraftId === state.eventDeck.rejectedTakeoff.aircraftId &&
          !rejectionRecoveryApproved(state)
        ) {
          return {
            status: "approval-required" as const,
            stateVersion: state.stateVersion,
            summary: `${aircraft.callsign} rejected takeoff; its recovery is Exceptional and requires an approved Recovery Plan.`,
            rationale:
              "A routine re-clearance does not restore Stable Flow after a rejected takeoff; stage a Recovery Plan for the Supervising Controller.",
            nextAction: "stage_recovery_plan" as const,
          };
        }

        const text = runwayClearanceText(aircraft.callsign, command.clearance);
        const unableReason = limitationUnableReason(
          state,
          aircraft.id,
          command.clearance.kind,
        );
        if (unableReason) {
          state.aircraft = state.aircraft.map((candidate) =>
            candidate.id === aircraft.id
              ? { ...candidate, pilotState: "awaiting-readback" }
              : candidate,
          );
          appendTransmission(state, "controller", aircraft.id, text);
          queuePilotReadback(
            state,
            aircraft.id,
            `${aircraft.callsign}, unable, ${unableReason}.`,
            "unable",
          );
        } else {
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
        }
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "runway-clearance-issued",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        for (const action of invalidateStagedPlans(state)) {
          const stateVersionBefore = state.stateVersion;
          state.stateVersion += 1;
          state.operationalReceipts.push({
            actor: command.actor,
            action,
            simulationTimeMs: state.simulationTimeMs,
            stateVersionBefore,
            stateVersionAfter: state.stateVersion,
          });
        }
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
        if (
          command.actor === "tower-agent" &&
          state.categoryOverrides["tactical-instruction"] === "withheld"
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Tactical Instruction is withheld by Category Override.",
            rationale:
              "The Supervising Controller withheld Tactical Instruction dispatch from the Tower Agent.",
            nextAction: "wait-for-tower-event" as const,
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

        const tacticalUnableReason = limitationUnableReason(
          state,
          aircraft.id,
          "tactical-instruction",
        );
        if (tacticalUnableReason) {
          state.aircraft = state.aircraft.map((candidate) =>
            candidate.id === aircraft.id
              ? { ...candidate, pilotState: "awaiting-readback" }
              : candidate,
          );
          appendTransmission(state, "controller", aircraft.id, text);
          queuePilotReadback(
            state,
            aircraft.id,
            `${aircraft.callsign}, unable, ${tacticalUnableReason}.`,
            "unable",
          );
        } else {
          state.aircraft = state.aircraft.map((candidate) =>
            candidate.id === aircraft.id
              ? {
                  ...candidate,
                  activeTacticalInstruction: structuredClone(
                    command.instruction,
                  ),
                  pilotState: "awaiting-readback",
                }
              : candidate,
          );
          appendTransmission(state, "controller", aircraft.id, text);
          queuePilotReadback(state, aircraft.id, text);
        }
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "tactical-instruction-issued",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        for (const action of invalidateStagedPlans(state)) {
          const stateVersionBefore = state.stateVersion;
          state.stateVersion += 1;
          state.operationalReceipts.push({
            actor: command.actor,
            action,
            simulationTimeMs: state.simulationTimeMs,
            stateVersionBefore,
            stateVersionAfter: state.stateVersion,
          });
        }
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
        const runwayClearances = command.runwayClearances ?? [];
        const tacticalInstructions = command.tacticalInstructions ?? [];
        const evaluation = evaluateRunwayClearanceSet(
          state,
          runwayClearances,
        );
        if (
          !evaluation.valid ||
          tacticalInstructions.some(
            ({ aircraftId, instruction }) =>
              !state.aircraft.some(
                ({ id, flightPhase }) =>
                  id === aircraftId && flightPhase !== "out-of-play",
              ) || !isValidPlanTacticalInstruction(instruction),
          )
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: `Clearance Plan ${command.planReference} cannot be staged from an invalid clearance set.`,
            nextAction: evaluation.nextAction,
          };
        }

        state.stagedClearancePlanReference = command.planReference;
        state.stagedClearancePlan = {
          reference: command.planReference,
          runwayClearances: structuredClone(runwayClearances),
          members: clearancePlanMembers(
            command.planReference,
            runwayClearances,
          ),
          tacticalInstructions: structuredClone(tacticalInstructions),
          tacticalMembers: tacticalPlanMembers(
            command.planReference,
            tacticalInstructions,
          ),
          classification: evaluation.classification,
          evaluatedStateVersion: state.stateVersion,
          expiresAtSimulationTimeMs:
            state.simulationTimeMs + PLAN_EXPIRY_WINDOW_MS,
        };
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

      if (command.type === "set-clearance-plan-member-selection") {
        const plan = state.stagedClearancePlan;
        if (!plan) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Clearance Plan member selection requires an active Clearance Plan.",
            nextAction: "get_tower_snapshot" as const,
          };
        }
        const member = plan.members.find(({ id }) => id === command.memberId);
        if (!member) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: `Clearance Plan member ${command.memberId} was not found.`,
            nextAction: "get_tower_snapshot" as const,
          };
        }

        const members = plan.members.map((candidate) =>
          candidate.id === command.memberId
            ? { ...candidate, selected: command.selected }
            : candidate,
        );
        const evaluation = evaluateRunwayClearanceSet(
          state,
          members
            .filter(({ selected }) => selected)
            .map(({ aircraftId, clearance }) => ({ aircraftId, clearance })),
        );
        if (!evaluation.valid) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "The selected Clearance Plan subset is not valid against the current Shift.",
            nextAction: evaluation.nextAction,
          };
        }

        state.stagedClearancePlan = {
          ...plan,
          members,
          classification: evaluation.classification,
          evaluatedStateVersion: state.stateVersion,
        };
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "clearance-plan-member-selection-updated",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `Clearance Plan member ${command.memberId} is ${
            command.selected ? "selected" : "deselected"
          }; the selected subset remains valid.`,
          nextAction: "await-plan-review" as const,
        };
      }

      if (command.type === "select-clearance-plan-alternative") {
        const plan = state.stagedClearancePlan;
        if (!plan) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Clearance Plan alternative selection requires an active Clearance Plan.",
            nextAction: "get_tower_snapshot" as const,
          };
        }
        const member = plan.members.find(({ id }) => id === command.memberId);
        const alternative = member?.alternatives.find(
          ({ id }) => id === command.alternativeId,
        );
        if (!member || !alternative) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: `Clearance Plan alternative ${command.alternativeId} was not found.`,
            nextAction: "get_tower_snapshot" as const,
          };
        }

        const members = plan.members.map((candidate) =>
          candidate.id === command.memberId
            ? {
                ...candidate,
                clearance: structuredClone(alternative.clearance),
                selected: true,
              }
            : candidate,
        );
        const evaluation = evaluateRunwayClearanceSet(
          state,
          members
            .filter(({ selected }) => selected)
            .map(({ aircraftId, clearance }) => ({ aircraftId, clearance })),
        );
        if (!evaluation.valid) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "The selected Clearance Plan subset is not valid with that alternative.",
            nextAction: evaluation.nextAction,
          };
        }

        state.stagedClearancePlan = {
          ...plan,
          runwayClearances: members.map(
            ({ aircraftId, clearance, alternatives }) => ({
              aircraftId,
              clearance: structuredClone(clearance),
              alternatives: alternatives.map(({ clearance }) =>
                structuredClone(clearance),
              ),
            }),
          ),
          members,
          classification: evaluation.classification,
          evaluatedStateVersion: state.stateVersion,
        };
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "clearance-plan-alternative-selected",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `Clearance Plan alternative ${command.alternativeId} selected; the selected subset remains valid.`,
          nextAction: "await-plan-review" as const,
        };
      }

      if (command.type === "edit-clearance-plan-tactical-instruction") {
        const plan = state.stagedClearancePlan;
        if (!plan) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "Clearance Plan Tactical Instruction editing requires an active Clearance Plan.",
            nextAction: "get_tower_snapshot" as const,
          };
        }
        if (
          command.changes.headingDegrees === undefined &&
          command.changes.altitudeFeet === undefined &&
          command.changes.speedKnots === undefined
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "Clearance Plan Tactical Instruction edits require heading, altitude, or speed.",
            nextAction: "get_tower_snapshot" as const,
          };
        }
        const member = plan.tacticalMembers.find(
          ({ id }) => id === command.memberId,
        );
        if (!member) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: `Clearance Plan Tactical Instruction ${command.memberId} was not found.`,
            nextAction: "get_tower_snapshot" as const,
          };
        }

        const tacticalMembers = plan.tacticalMembers.map((candidate) =>
          candidate.id === command.memberId
            ? {
                ...candidate,
                instruction: {
                  ...candidate.instruction,
                  ...(command.changes.headingDegrees === undefined
                    ? {}
                    : { headingDegrees: command.changes.headingDegrees }),
                  ...(command.changes.altitudeFeet === undefined
                    ? {}
                    : { altitudeFeet: command.changes.altitudeFeet }),
                  ...(command.changes.speedKnots === undefined
                    ? {}
                    : { speedKnots: command.changes.speedKnots }),
                },
              }
            : candidate,
        );
        const evaluation = evaluateRunwayClearanceSet(
          state,
          plan.members
            .filter(({ selected }) => selected)
            .map(({ aircraftId, clearance }) => ({ aircraftId, clearance })),
        );
        if (
          !evaluation.valid ||
          tacticalMembers
            .filter(({ selected }) => selected)
            .some(
              ({ aircraftId, instruction }) =>
                !state.aircraft.some(
                  ({ id, flightPhase }) =>
                    id === aircraftId && flightPhase !== "out-of-play",
                ) || !isValidPlanTacticalInstruction(instruction),
            )
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "The selected Clearance Plan subset is not valid after that Tactical Instruction edit.",
            nextAction: evaluation.nextAction,
          };
        }

        state.stagedClearancePlan = {
          ...plan,
          tacticalInstructions: tacticalMembers.map(({ aircraftId, instruction }) => ({
            aircraftId,
            instruction: structuredClone(instruction),
          })),
          tacticalMembers,
          classification: evaluation.classification,
          evaluatedStateVersion: state.stateVersion,
        };
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "clearance-plan-tactical-instruction-edited",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `Clearance Plan Tactical Instruction ${command.memberId} edited; the selected subset remains valid.`,
          nextAction: "await-plan-review" as const,
        };
      }

      if (command.type === "dispatch-selected-clearance-plan") {
        const plan = state.stagedClearancePlan;
        if (!plan) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Clearance Plan dispatch requires an active Clearance Plan.",
            nextAction: "get_tower_snapshot" as const,
          };
        }
        const selectedMembers = plan.members.filter(({ selected }) => selected);
        if (selectedMembers.length === 0) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Clearance Plan dispatch requires at least one selected member.",
            nextAction: "await-plan-review" as const,
          };
        }
        const evaluation = evaluateRunwayClearanceSet(
          state,
          selectedMembers.map(({ aircraftId, clearance }) => ({
            aircraftId,
            clearance,
          })),
        );
        if (!evaluation.valid) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "The selected Clearance Plan subset is no longer valid against the current Shift.",
            nextAction: evaluation.nextAction,
          };
        }
        const selectedAircraft = selectedMembers.map((member) => ({
          ...member,
          aircraft: state.aircraft.find(({ id }) => id === member.aircraftId),
        }));
        if (
          selectedAircraft.some(
            ({ aircraft }) => !aircraft || aircraft.flightPhase === "out-of-play",
          )
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "The selected Clearance Plan subset contains an inactive aircraft.",
            nextAction: "get_tower_snapshot" as const,
          };
        }

        state.aircraft = state.aircraft.map((aircraft) => {
          const member = selectedMembers.find(
            ({ aircraftId }) => aircraftId === aircraft.id,
          );
          if (!member) {
            return aircraft;
          }
          if (
            limitationUnableReason(state, aircraft.id, member.clearance.kind)
          ) {
            return { ...aircraft, pilotState: "awaiting-readback" };
          }
          return {
            ...aircraft,
            activeRunwayClearance: structuredClone(member.clearance),
            pilotState: "awaiting-readback",
          };
        });
        for (const { aircraft, clearance } of selectedAircraft) {
          const text = runwayClearanceText(aircraft!.callsign, clearance);
          appendTransmission(state, "controller", aircraft!.id, text);
          const unableReason = limitationUnableReason(
            state,
            aircraft!.id,
            clearance.kind,
          );
          if (unableReason) {
            queuePilotReadback(
              state,
              aircraft!.id,
              `${aircraft!.callsign}, unable, ${unableReason}.`,
              "unable",
            );
          } else {
            queuePilotReadback(state, aircraft!.id, text);
          }
        }
        delete state.stagedClearancePlan;
        delete state.stagedClearancePlanReference;
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "clearance-plan-dispatched",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `Clearance Plan ${plan.reference} dispatched ${selectedMembers.length} selected clearance member${
            selectedMembers.length === 1 ? "" : "s"
          }.`,
          nextAction: "continue" as const,
        };
      }

      if (command.type === "approve-recovery-plan") {
        const plan = state.stagedRecoveryPlan;
        if (!plan) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Recovery Plan approval requires an active Recovery Plan.",
            nextAction: "get_tower_snapshot" as const,
          };
        }
        const selectedMembers = plan.members.filter(({ selected }) => selected);
        const evaluation = evaluateRunwayClearanceSet(
          state,
          selectedMembers.map(({ aircraftId, clearance }) => ({
            aircraftId,
            clearance,
          })),
        );
        if (
          !evaluation.valid ||
          evaluation.classification !== "exceptional-recovery"
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "Recovery Plan approval requires the current valid Exceptional Recovery set.",
            nextAction: evaluation.valid
              ? ("stage-recovery-plan" as const)
              : evaluation.nextAction,
          };
        }
        const selectedAircraft = selectedMembers.map((member) => ({
          ...member,
          aircraft: state.aircraft.find(({ id }) => id === member.aircraftId),
        }));
        if (
          selectedAircraft.some(
            ({ aircraft }) => !aircraft || aircraft.flightPhase === "out-of-play",
          )
        ) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: "Recovery Plan approval contains an inactive aircraft.",
            nextAction: "get_tower_snapshot" as const,
          };
        }

        state.aircraft = state.aircraft.map((aircraft) => {
          const member = selectedMembers.find(
            ({ aircraftId }) => aircraftId === aircraft.id,
          );
          if (!member) {
            return aircraft;
          }
          if (
            limitationUnableReason(state, aircraft.id, member.clearance.kind)
          ) {
            return { ...aircraft, pilotState: "awaiting-readback" };
          }
          return {
            ...aircraft,
            activeRunwayClearance: structuredClone(member.clearance),
            pilotState: "awaiting-readback",
          };
        });
        for (const { aircraft, clearance } of selectedAircraft) {
          const text = runwayClearanceText(aircraft!.callsign, clearance);
          appendTransmission(state, "controller", aircraft!.id, text);
          const unableReason = limitationUnableReason(
            state,
            aircraft!.id,
            clearance.kind,
          );
          if (unableReason) {
            queuePilotReadback(
              state,
              aircraft!.id,
              `${aircraft!.callsign}, unable, ${unableReason}.`,
              "unable",
            );
          } else {
            queuePilotReadback(state, aircraft!.id, text);
          }
        }
        delete state.stagedRecoveryPlan;
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "recovery-plan-approved-and-dispatched",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `Recovery Plan ${plan.reference} approved and dispatched ${selectedMembers.length} clearance member${
            selectedMembers.length === 1 ? "" : "s"
          }.`,
          nextAction: "continue" as const,
        };
      }

      if (
        command.type === "stage-recovery-plan" &&
        state.operatingPosture === "observe"
      ) {
        return {
          status: "refusal" as const,
          stateVersion: state.stateVersion,
          summary:
            "Recovery Plan staging requires Assist or Take the Sector.",
          rationale: "Observe permits read and evaluation capabilities only.",
          nextAction: "request-authority-increase" as const,
        };
      }

      if (command.type === "stage-recovery-plan") {
        const evaluation = evaluateRunwayClearanceSet(
          state,
          command.runwayClearances,
        );
        if (!evaluation.valid) {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary: `Recovery Plan ${command.planReference} cannot be staged from an invalid clearance set.`,
            nextAction: evaluation.nextAction,
          };
        }
        if (evaluation.classification !== "exceptional-recovery") {
          return {
            status: "refusal" as const,
            stateVersion: state.stateVersion,
            summary:
              "Recovery Plan staging requires an Exceptional Recovery clearance set.",
            nextAction: "stage-clearance-plan" as const,
          };
        }

        state.stagedRecoveryPlan = {
          reference: command.planReference,
          runwayClearances: structuredClone(command.runwayClearances),
          members: clearancePlanMembers(
            command.planReference,
            command.runwayClearances,
          ),
          tacticalInstructions: [],
          tacticalMembers: [],
          classification: evaluation.classification,
          evaluatedStateVersion: state.stateVersion,
          expiresAtSimulationTimeMs:
            state.simulationTimeMs + PLAN_EXPIRY_WINDOW_MS,
        };
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "recovery-plan-staged",
          simulationTimeMs: state.simulationTimeMs,
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "approval-required" as const,
          stateVersion: state.stateVersion,
          summary: `Recovery Plan ${command.planReference} staged for explicit human approval.`,
          nextAction: "review-recovery-plan" as const,
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
            : state.shiftStatus !== "active"
              ? [...OBSERVE_CAPABILITIES]
              : activeCapabilities(
                  state.operatingPosture,
                  state.categoryOverrides,
                );
        case "tower-snapshot":
          return query.sections || query.detail
            ? selectedTowerSnapshot(
                query.sections ?? [
                  "authority",
                  "weather",
                  "runways",
                  "traffic",
                  "plans",
                  "transmissions",
                ],
                query.detail ?? "compact",
              )
            : towerSnapshot();
        case "capabilities-to-register":
          return state.shiftStatus === "completed" ||
            state.shiftStatus === "incomplete"
            ? [...OBSERVE_CAPABILITIES]
            : state.capabilitySynchronization === "pending" &&
                state.pendingOperatingPosture
              ? activeCapabilities(
                  state.pendingOperatingPosture,
                  state.categoryOverrides,
                )
              : state.shiftStatus === "armed"
                ? (["begin_tower_shift"] satisfies Capability[])
                : activeCapabilities(
                    state.operatingPosture,
                    state.categoryOverrides,
                  );
        case "operational-receipts":
          return [...state.operationalReceipts];
        case "transmissions":
          return structuredClone(state.transmissions);
        case "selected-context": {
          const selectedAircraftId = state.selectedAircraftId;
          const selectedAircraft = state.aircraft.find(
            ({ id, flightPhase }) =>
              id === selectedAircraftId && flightPhase !== "out-of-play",
          );
          const activeConflicts = activeConflictsAt(state, { detail: "full" });
          const relatedConflicts = selectedAircraftId
            ? [...activeConflicts.current, ...activeConflicts.predicted].filter(
                ({ aircraftIds }) => aircraftIds.includes(selectedAircraftId),
              )
            : [];
          const relatedPlanMembers = selectedAircraftId
            ? [
                ...(
                  [
                    ["clearance-plan", state.stagedClearancePlan],
                    ["recovery-plan", state.stagedRecoveryPlan],
                  ] as const
                ).flatMap(([planType, plan]) =>
                  plan
                    ? [
                        ...plan.members
                          .filter(
                            ({ aircraftId }) =>
                              aircraftId === selectedAircraftId,
                          )
                          .map((member) => ({
                            planType,
                            planReference: plan.reference,
                            memberType: "runway-clearance" as const,
                            memberId: member.id,
                            selected: member.selected,
                            clearance: structuredClone(member.clearance),
                          })),
                        ...plan.tacticalMembers
                          .filter(
                            ({ aircraftId }) =>
                              aircraftId === selectedAircraftId,
                          )
                          .map((member) => ({
                            planType,
                            planReference: plan.reference,
                            memberType: "tactical-instruction" as const,
                            memberId: member.id,
                            selected: member.selected,
                            instruction: structuredClone(member.instruction),
                          })),
                      ]
                    : [],
                ),
              ]
            : [];
          return {
            selectionStatus: selectedAircraft
              ? ("selected" as const)
              : selectedAircraftId
                ? ("unavailable" as const)
                : ("none" as const),
            selectedAircraftId,
            selectedAircraft: structuredClone(selectedAircraft),
            relatedConflicts,
            relatedPlanMembers,
            recentTransmissions: selectedAircraft
              ? structuredClone(
                  state.transmissions
                    .filter(
                      ({ aircraftId }) => aircraftId === selectedAircraft.id,
                    )
                    .slice(-5),
                )
              : [],
          };
        }
        case "active-conflicts":
          return activeConflictsAt(state, query);
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
          return evaluateRunwayClearanceSet(
            state,
            query.runwayClearances,
            query.effectiveAtSimulationTimeMs,
          );
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
          {
            const pendingEvent = monitoringEventAt(
              state.operationalReceipts,
              query.cursor,
            );
            if (pendingEvent) {
              return Promise.resolve(pendingEvent);
            }
          }
          return new Promise((resolve) => {
            let timer: ReturnType<typeof globalThis.setTimeout>;
            const finish = (result: Record<string, unknown>) => {
              query.signal?.removeEventListener("abort", cancel);
              subscribers.delete(checkForEvent);
              resolve(result);
            };
            const cancel = () => {
              globalThis.clearTimeout(timer);
              finish({
                eventKind: "wait-cancelled",
                priority: "routine",
                cursor: query.cursor,
                stateVersion: state.stateVersion,
                simulationTime: state.simulationTimeMs,
                summary: "Tower-event wait was cancelled.",
                actionRequired: false,
              });
            };
            const checkForEvent = () => {
              const event = monitoringEventAt(
                state.operationalReceipts,
                query.cursor,
              );
              if (event) {
                globalThis.clearTimeout(timer);
                finish(event);
              }
            };
            subscribers.add(checkForEvent);
            timer = globalThis.setTimeout(() => {
              finish({
                eventKind: "heartbeat",
                priority: "routine",
                cursor: query.cursor,
                stateVersion: state.stateVersion,
                simulationTime: state.simulationTimeMs,
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
