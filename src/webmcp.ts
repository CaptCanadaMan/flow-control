import type {
  ActiveConflictScope,
  FlowControlApplication,
  TowerSnapshot,
  TowerSnapshotDetail,
  TowerSnapshotSection,
} from "./application";
import {
  isWebMcpCapability,
  WEBMCP_TOOL_CONTRACTS,
  type WebMcpCapability,
  type WebMcpResult,
  type WebMcpResultStatus,
} from "./webmcp-contract";

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
  execute: (
    input: unknown,
    context?: AbortSignal | { signal?: AbortSignal },
  ) => unknown;
};

export type ModelContext = {
  registerTool(
    tool: WebMcpTool,
    options: { signal: AbortSignal },
  ): Promise<void>;
};

type CandidateRunwayClearanceInput = {
  aircraftId: string;
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
  };
};

type ApplicationCommand = Parameters<FlowControlApplication["command"]>[0];
type IssueRunwayClearanceInput = Omit<
  Extract<ApplicationCommand, { type: "issue-runway-clearance" }>,
  "type" | "actor"
>;
type IssueTacticalInstructionInput = Omit<
  Extract<ApplicationCommand, { type: "issue-tactical-instruction" }>,
  "type" | "actor"
>;

function executionSignal(
  context?: AbortSignal | { signal?: AbortSignal },
) {
  if (
    context &&
    "addEventListener" in context &&
    typeof context.addEventListener === "function" &&
    "removeEventListener" in context &&
    typeof context.removeEventListener === "function"
  ) {
    return context;
  }

  const signal = context && "signal" in context ? context.signal : undefined;
  return signal &&
    typeof signal.addEventListener === "function" &&
    typeof signal.removeEventListener === "function"
    ? signal
    : undefined;
}

const RESULT_STATUSES = new Set<WebMcpResultStatus>([
  "success",
  "refusal",
  "approval-required",
  "stale",
  "unavailable",
]);

function recordOutcome(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function resultEnvelope<T>({
  application,
  outcome,
  summary,
  nextAction,
  affectedAircraft: affectedAircraftOverride,
  data,
}: {
  application: FlowControlApplication;
  outcome?: Record<string, unknown>;
  summary: string;
  nextAction?: string;
  affectedAircraft?: readonly string[];
  data?: T;
}): WebMcpResult<T> {
  const snapshot = application.query({
    type: "tower-snapshot",
  }) as TowerSnapshot;
  const status =
    typeof outcome?.status === "string" &&
    RESULT_STATUSES.has(outcome.status as WebMcpResultStatus)
      ? (outcome.status as WebMcpResultStatus)
      : "success";
  const affectedAircraft = Array.isArray(outcome?.affectedAircraft)
    ? outcome.affectedAircraft.filter(
        (aircraftId): aircraftId is string => typeof aircraftId === "string",
      )
    : affectedAircraftOverride
      ? [...affectedAircraftOverride]
      : [];
  const simulationTimeMs =
    typeof outcome?.simulationTimeMs === "number"
      ? outcome.simulationTimeMs
      : typeof outcome?.simulationTime === "number"
        ? outcome.simulationTime
        : snapshot.simulationTimeMs;

  return {
    status,
    stateVersion:
      typeof outcome?.stateVersion === "number"
        ? outcome.stateVersion
        : snapshot.stateVersion,
    simulationTimeMs,
    affectedAircraft,
    summary:
      typeof outcome?.summary === "string" ? outcome.summary : summary,
    ...(typeof outcome?.rationale === "string"
      ? { rationale: outcome.rationale }
      : {}),
    ...(typeof outcome?.expiresAtSimulationTimeMs === "number"
      ? { expiresAtSimulationTimeMs: outcome.expiresAtSimulationTimeMs }
      : {}),
    ...(typeof outcome?.nextAction === "string"
      ? { nextAction: outcome.nextAction }
      : nextAction
        ? { nextAction }
        : {}),
    ...(data === undefined ? {} : { data }),
  };
}

export async function connectWebMcp({
  application,
  modelContext,
}: {
  application: FlowControlApplication;
  modelContext: ModelContext;
}) {
  let lifecycles = [new AbortController()];
  let registeredCapabilities: string[] = [];
  let capabilityKey = "";
  let pendingSynchronization = Promise.resolve();

  async function registerCapabilities(
    capabilities: string[],
    lifecycle: AbortController,
  ) {
    await Promise.all(
      capabilities.map((capability) => {
        if (!isWebMcpCapability(capability)) {
          throw new Error(`Unknown WebMCP capability: ${capability}`);
        }
        return modelContext.registerTool(toolFor(capability), {
          signal: lifecycle.signal,
        });
      }),
    );
  }

  async function registerCurrentCapabilities() {
    const capabilities = application.query({
      type: "available-capabilities",
    }) as string[];
    await registerCapabilities(capabilities, lifecycles[0]);
    registeredCapabilities = capabilities;
    capabilityKey = capabilities.join("|");
  }

  async function synchronizeCapabilities() {
    const capabilities = application.query({
      type: "capabilities-to-register",
    }) as string[];
    const nextCapabilityKey = capabilities.join("|");

    if (nextCapabilityKey === capabilityKey) {
      return;
    }

    const isExpansion = registeredCapabilities.every((capability) =>
      capabilities.includes(capability),
    );

    if (isExpansion) {
      const addedCapabilities = capabilities.filter(
        (capability) => !registeredCapabilities.includes(capability),
      );
      const grantLifecycle = new AbortController();
      lifecycles.push(grantLifecycle);
      await registerCapabilities(addedCapabilities, grantLifecycle);
      registeredCapabilities = capabilities;
      capabilityKey = nextCapabilityKey;

      const snapshot = application.query({ type: "tower-snapshot" });
      if (
        "capabilitySynchronization" in snapshot &&
        snapshot.capabilitySynchronization === "pending"
      ) {
        application.command({
          type: "complete-capability-synchronization",
          actor: "capability-registry",
          expectedStateVersion: snapshot.stateVersion,
        });
      }
      return;
    }

    lifecycles.forEach((lifecycle) => lifecycle.abort());
    lifecycles = [new AbortController()];
    await registerCapabilities(capabilities, lifecycles[0]);
    registeredCapabilities = capabilities;
    capabilityKey = nextCapabilityKey;
  }

  function renewAgentLease() {
    application.command({
      type: "renew-agent-lease",
      actor: "capability-registry",
    });
  }

  function toolFor(capability: WebMcpCapability): WebMcpTool {
    const contract = WEBMCP_TOOL_CONTRACTS[capability];

    if (capability === "begin_tower_shift") {
      return {
        name: capability,
        ...contract,
        async execute(input) {
          const { expectedStateVersion } = input as {
            expectedStateVersion: number;
          };
          const result = application.command({
            type: "begin-shift",
            actor: "tower-agent",
            expectedStateVersion,
          });

          await pendingSynchronization;
          return resultEnvelope({
            application,
            outcome: result,
            summary: "Tower Agent Shift connection processed.",
          });
        },
      };
    }

    if (capability === "get_tower_snapshot") {
      return {
        name: capability,
        ...contract,
        execute(input) {
          renewAgentLease();
          const { sections, detail = "compact" } = input as {
            sections?: TowerSnapshotSection[];
            detail?: TowerSnapshotDetail;
          };
          const snapshot = application.query({
            type: "tower-snapshot",
            sections,
            detail,
          });
          return resultEnvelope({
            application,
            summary: "Tower snapshot returned.",
            nextAction: "wait_for_tower_event",
            data: snapshot,
          });
        },
      };
    }

    if (capability === "wait_for_tower_event") {
      return {
        name: capability,
        ...contract,
        execute(input, context) {
          renewAgentLease();
          application.command({
            type: "set-agent-wait",
            actor: "capability-registry",
            active: true,
          });
          const { cursor, heartbeatAfterMs } = input as {
            cursor: number;
            heartbeatAfterMs: number;
          };
          const waiting = application.query({
            type: "wait-for-tower-event",
            cursor,
            heartbeatAfterMs,
            signal: executionSignal(context),
          });
          return Promise.resolve(waiting)
            .then((event) =>
              resultEnvelope({
                application,
                outcome: recordOutcome(event),
                summary: "Tower event wait completed.",
                nextAction: "wait_for_tower_event",
                data: event,
              }),
            )
            .finally(() => {
              application.command({
                type: "set-agent-wait",
                actor: "capability-registry",
                active: false,
              });
            });
        },
      };
    }

    if (capability === "get_selected_context") {
      return {
        name: capability,
        ...contract,
        execute() {
          renewAgentLease();
          const selectedContext = application.query({
            type: "selected-context",
          }) as {
            selectionStatus: "none" | "selected" | "unavailable";
            selectedAircraftId?: string;
          };
          return resultEnvelope({
            application,
            summary: "Supervising Controller selection returned.",
            nextAction: "continue",
            affectedAircraft: selectedContext.selectedAircraftId
              ? [selectedContext.selectedAircraftId]
              : [],
            data: selectedContext,
          });
        },
      };
    }

    if (capability === "get_active_conflicts") {
      return {
        name: capability,
        ...contract,
        execute(input) {
          renewAgentLease();
          const {
            scope = "all",
            detail = "compact",
            lookaheadMs = 120_000,
          } = input as {
            scope?: ActiveConflictScope;
            detail?: TowerSnapshotDetail;
            lookaheadMs?: number;
          };
          const conflicts = application.query({
            type: "active-conflicts",
            scope,
            detail,
            lookaheadMs,
          }) as {
            current: Array<{ aircraftIds: string[] }>;
            predicted: Array<{ aircraftIds: string[] }>;
          };
          const allConflicts = [...conflicts.current, ...conflicts.predicted];
          const affectedAircraft = [
            ...new Set(
              allConflicts.flatMap(({ aircraftIds }) => aircraftIds),
            ),
          ];
          return resultEnvelope({
            application,
            summary:
              allConflicts.length === 0
                ? "No current or predicted operational conflicts."
                : `${conflicts.current.length} current and ${conflicts.predicted.length} predicted operational conflicts returned.`,
            nextAction: "wait_for_tower_event",
            affectedAircraft,
            data: conflicts,
          });
        },
      };
    }

    if (capability === "evaluate_clearance_set") {
      return {
        name: capability,
        ...contract,
        execute(input) {
          renewAgentLease();
          const {
            expectedStateVersion,
            projectedSimulationTimeMs,
            runwayClearances,
          } = input as {
            expectedStateVersion: number;
            projectedSimulationTimeMs?: number;
            runwayClearances: CandidateRunwayClearanceInput[];
          };
          const evaluation = application.query({
            type: "evaluate-clearance-set",
            expectedStateVersion,
            ...(projectedSimulationTimeMs === undefined
              ? {}
              : { effectiveAtSimulationTimeMs: projectedSimulationTimeMs }),
            runwayClearances,
          });
          return resultEnvelope({
            application,
            outcome: recordOutcome(evaluation),
            summary: "Clearance-set evaluation returned.",
            data: evaluation,
          });
        },
      };
    }

    if (capability === "stage_clearance_plan") {
      return {
        name: capability,
        ...contract,
        execute(input) {
          renewAgentLease();
          const { planReference, expectedStateVersion } = input as {
            planReference: string;
            expectedStateVersion: number;
          };
          const result = application.command({
            type: "stage-clearance-plan",
            actor: "tower-agent",
            planReference,
            expectedStateVersion,
          });
          return resultEnvelope({
            application,
            outcome: result,
            summary: "Clearance Plan staging processed.",
          });
        },
      };
    }

    if (capability === "issue_runway_clearance") {
      return {
        name: capability,
        ...contract,
        execute(input) {
          renewAgentLease();
          const { aircraftId, clearance, expectedStateVersion } =
            input as IssueRunwayClearanceInput;
          const result = application.command({
            type: "issue-runway-clearance",
            actor: "tower-agent",
            aircraftId,
            clearance,
            expectedStateVersion,
          });
          return resultEnvelope({
            application,
            outcome: result,
            summary: "Runway Clearance dispatch processed.",
            affectedAircraft: [aircraftId],
          });
        },
      };
    }

    if (capability === "issue_tactical_instruction") {
      return {
        name: capability,
        ...contract,
        execute(input) {
          renewAgentLease();
          const { aircraftId, instruction, expectedStateVersion } =
            input as IssueTacticalInstructionInput;
          const result = application.command({
            type: "issue-tactical-instruction",
            actor: "tower-agent",
            aircraftId,
            instruction,
            expectedStateVersion,
          });
          return resultEnvelope({
            application,
            outcome: result,
            summary: "Tactical Instruction dispatch processed.",
            affectedAircraft: [aircraftId],
          });
        },
      };
    }

    return {
      name: capability,
      ...contract,
      execute() {
        renewAgentLease();
        const snapshot = application.query({
          type: "tower-snapshot",
        }) as TowerSnapshot;
        return resultEnvelope({
          application,
          summary: `${capability} context returned.`,
          nextAction: "continue",
          data: snapshot,
        });
      },
    };
  }

  await registerCurrentCapabilities();
  const unsubscribe = application.subscribe(() => {
    pendingSynchronization = pendingSynchronization.then(
      synchronizeCapabilities,
    );
  });

  return {
    disconnect() {
      unsubscribe();
      lifecycles.forEach((lifecycle) => lifecycle.abort());
    },
  };
}
