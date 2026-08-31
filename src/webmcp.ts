import type { FlowControlApplication, TowerSnapshot } from "./application";
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
  data,
}: {
  application: FlowControlApplication;
  outcome?: Record<string, unknown>;
  summary: string;
  nextAction?: string;
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
        execute() {
          renewAgentLease();
          const snapshot = application.query({
            type: "tower-snapshot",
          }) as TowerSnapshot;
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
