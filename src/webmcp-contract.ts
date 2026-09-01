export type JsonSchema = Record<string, unknown>;

export type WebMcpResultStatus =
  | "success"
  | "refusal"
  | "approval-required"
  | "stale"
  | "unavailable";

export type WebMcpResult<T = unknown> = {
  status: WebMcpResultStatus;
  stateVersion: number;
  simulationTimeMs: number;
  affectedAircraft: string[];
  summary: string;
  rationale?: string;
  expiresAtSimulationTimeMs?: number;
  nextAction?: string;
  data?: T;
};

export function strictObjectSchema(
  properties: Record<string, JsonSchema> = {},
  required: readonly string[] = [],
): JsonSchema {
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required: [...required] } : {}),
    additionalProperties: false,
  };
}

export const TOWER_SNAPSHOT_SECTIONS = [
  "authority",
  "weather",
  "runways",
  "traffic",
  "plans",
  "transmissions",
] as const;

export const READ_DETAIL_LEVELS = ["compact", "full"] as const;

const RUNWAY_CLEARANCE_SCHEMA = strictObjectSchema(
  {
    kind: {
      type: "string",
      enum: [
        "hold-short",
        "line-up-and-wait",
        "cancel-runway-clearance",
        "clear-for-takeoff",
        "clear-to-land",
        "clear-touch-and-go",
        "go-around",
      ],
      description: "The structured runway operation to dispatch.",
    },
    runwayId: {
      type: "string",
      enum: ["09-27", "04-22"],
      description: "The runway resource used by the Clearance.",
    },
    runwayEnd: {
      type: "string",
      enum: ["09", "27", "04", "22"],
      description: "The matching runway end used in the Transmission.",
    },
  },
  ["kind", "runwayId", "runwayEnd"],
);
RUNWAY_CLEARANCE_SCHEMA.allOf = [
  {
    if: {
      properties: { runwayId: { const: "09-27" } },
      required: ["runwayId"],
    },
    then: {
      properties: { runwayEnd: { enum: ["09", "27"] } },
      required: ["runwayEnd"],
    },
  },
  {
    if: {
      properties: { runwayId: { const: "04-22" } },
      required: ["runwayId"],
    },
    then: {
      properties: { runwayEnd: { enum: ["04", "22"] } },
      required: ["runwayEnd"],
    },
  },
];

const CANDIDATE_RUNWAY_CLEARANCE_SCHEMA = strictObjectSchema(
  {
    aircraftId: { type: "string", minLength: 1 },
    clearance: RUNWAY_CLEARANCE_SCHEMA,
  },
  ["aircraftId", "clearance"],
);

const TACTICAL_INSTRUCTION_PROPERTIES = [
  "headingDegrees",
  "altitudeFeet",
  "speedKnots",
  "circuit",
  "sequenceBehindAircraftId",
  "extendCircuitLeg",
  "localHoldId",
  "orbitDirection",
] as const;

const TACTICAL_INSTRUCTION_SCHEMA = strictObjectSchema({
  headingDegrees: {
    type: "integer",
    minimum: 1,
    maximum: 360,
    description: "Assigned magnetic heading in whole degrees.",
  },
  altitudeFeet: {
    type: "integer",
    minimum: 1,
    description: "Assigned altitude in whole feet.",
  },
  speedKnots: {
    type: "integer",
    minimum: 1,
    description: "Assigned speed in whole knots.",
  },
  circuit: strictObjectSchema(
    {
      action: {
        type: "string",
        enum: ["enter", "adjust"],
        description: "Whether to enter or adjust the named circuit.",
      },
      circuitId: {
        type: "string",
        enum: ["runway-09-left"],
        description: "The named circuit in the current airport model.",
      },
    },
    ["action", "circuitId"],
  ),
  sequenceBehindAircraftId: {
    type: "string",
    minLength: 1,
    description: "The active aircraft to follow in sequence.",
  },
  extendCircuitLeg: {
    type: "string",
    enum: ["upwind", "crosswind", "downwind", "base"],
    description: "The circuit leg to extend.",
  },
  localHoldId: {
    type: "string",
    enum: ["northwest-hold", "southeast-hold"],
    description: "The named local holding area to use.",
  },
  orbitDirection: {
    type: "string",
    enum: ["left", "right"],
    description: "The direction of one 360-degree orbit.",
  },
});

TACTICAL_INSTRUCTION_SCHEMA.anyOf = TACTICAL_INSTRUCTION_PROPERTIES.map(
  (property) => ({ required: [property] }),
);

export const WEBMCP_TOOL_CONTRACTS = {
  begin_tower_shift: {
    description:
      "Connect the Tower Agent and begin the armed Shift at the current State Version.",
    inputSchema: strictObjectSchema(
      { expectedStateVersion: { type: "integer", minimum: 0 } },
      ["expectedStateVersion"],
    ),
    annotations: { readOnlyHint: false },
  },
  get_tower_snapshot: {
    description:
      "Read selected sections of current authoritative Shift state. Omit sections for all sections; compact detail is the default.",
    inputSchema: strictObjectSchema({
      sections: {
        type: "array",
        items: { type: "string", enum: [...TOWER_SNAPSHOT_SECTIONS] },
        minItems: 1,
        uniqueItems: true,
      },
      detail: { type: "string", enum: [...READ_DETAIL_LEVELS] },
    }),
    annotations: { readOnlyHint: true },
  },
  wait_for_tower_event: {
    description:
      "Wait for a relevant tower event or a bounded monitoring heartbeat.",
    inputSchema: strictObjectSchema(
      {
        cursor: { type: "integer", minimum: 0 },
        heartbeatAfterMs: { type: "integer", minimum: 1 },
      },
      ["cursor", "heartbeatAfterMs"],
    ),
    annotations: { readOnlyHint: true },
  },
  get_selected_context: {
    description:
      "Return the Supervising Controller's current visual selection and related operational context.",
    inputSchema: strictObjectSchema(),
    annotations: { readOnlyHint: true },
  },
  get_active_conflicts: {
    description:
      "Read current and predicted conflict facts from authoritative Shift state, optionally narrowed by time scope and detail. This tool does not recommend a resolution.",
    inputSchema: strictObjectSchema({
      scope: {
        type: "string",
        enum: ["all", "current", "predicted"],
      },
      detail: { type: "string", enum: [...READ_DETAIL_LEVELS] },
      lookaheadMs: {
        type: "integer",
        minimum: 0,
        maximum: 600_000,
      },
    }),
    annotations: { readOnlyHint: true },
  },
  evaluate_clearance_set: {
    description:
      "Evaluate one or more counterfactual runway Clearances at the required State Version without staging, dispatching, or changing Shift state.",
    inputSchema: strictObjectSchema(
      {
        expectedStateVersion: { type: "integer", minimum: 0 },
        projectedSimulationTimeMs: { type: "integer", minimum: 0 },
        runwayClearances: {
          type: "array",
          minItems: 1,
          items: CANDIDATE_RUNWAY_CLEARANCE_SCHEMA,
        },
      },
      ["expectedStateVersion", "runwayClearances"],
    ),
    annotations: { readOnlyHint: true },
  },
  stage_clearance_plan: {
    description:
      "Stage a reversible Clearance Plan for Supervising Controller review when active authority permits it.",
    inputSchema: strictObjectSchema(
      {
        planReference: { type: "string", minLength: 1 },
        expectedStateVersion: { type: "integer", minimum: 0 },
      },
      ["planReference", "expectedStateVersion"],
    ),
    annotations: { readOnlyHint: false },
  },
  stage_recovery_plan: {
    description:
      "Stage an Exceptional Recovery Plan for explicit Supervising Controller review.",
    inputSchema: strictObjectSchema(),
    annotations: { readOnlyHint: false },
  },
  issue_runway_clearance: {
    description:
      "Dispatch one runway Clearance as the Tower Agent. Requires Take the Sector authority and the current State Version; policy revalidates authority, aircraft capability, runway occupancy, intersections, and other Hard Safety Invariants. Returns the canonical operational result envelope.",
    inputSchema: strictObjectSchema(
      {
        aircraftId: {
          type: "string",
          minLength: 1,
          description: "The active aircraft receiving the Clearance.",
        },
        clearance: RUNWAY_CLEARANCE_SCHEMA,
        expectedStateVersion: {
          type: "integer",
          minimum: 0,
          description:
            "The authoritative State Version used to choose this Clearance.",
        },
      },
      ["aircraftId", "clearance", "expectedStateVersion"],
    ),
    annotations: { readOnlyHint: false },
  },
  issue_tactical_instruction: {
    description:
      "Dispatch one compound Tactical Instruction as the Tower Agent. Requires Take the Sector authority and the current State Version; compatible heading, altitude, speed, circuit, sequence, extension, hold, and orbit components may be combined, and Policy Security revalidates operational compatibility. Returns the canonical operational result envelope.",
    inputSchema: strictObjectSchema(
      {
        aircraftId: {
          type: "string",
          minLength: 1,
          description: "The active aircraft receiving the instruction.",
        },
        instruction: TACTICAL_INSTRUCTION_SCHEMA,
        expectedStateVersion: {
          type: "integer",
          minimum: 0,
          description:
            "The authoritative State Version used to choose this instruction.",
        },
      },
      ["aircraftId", "instruction", "expectedStateVersion"],
    ),
    annotations: { readOnlyHint: false },
  },
} as const;

export type WebMcpCapability = keyof typeof WEBMCP_TOOL_CONTRACTS;

export function isWebMcpCapability(
  capability: string,
): capability is WebMcpCapability {
  return capability in WEBMCP_TOOL_CONTRACTS;
}
