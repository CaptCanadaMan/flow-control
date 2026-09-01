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
      "Evaluate a counterfactual set of runway Clearances without changing Shift state.",
    inputSchema: strictObjectSchema(),
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
      "Issue one policy-validated runway Clearance within current delegated authority.",
    inputSchema: strictObjectSchema(),
    annotations: { readOnlyHint: false },
  },
  issue_tactical_instruction: {
    description:
      "Issue one policy-validated compound Tactical Instruction within current delegated authority.",
    inputSchema: strictObjectSchema(),
    annotations: { readOnlyHint: false },
  },
} as const;

export type WebMcpCapability = keyof typeof WEBMCP_TOOL_CONTRACTS;

export function isWebMcpCapability(
  capability: string,
): capability is WebMcpCapability {
  return capability in WEBMCP_TOOL_CONTRACTS;
}
