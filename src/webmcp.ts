import type { FlowControlApplication } from "./application";

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, signal?: AbortSignal) => unknown;
};

export type ModelContext = {
  registerTool(
    tool: WebMcpTool,
    options: { signal: AbortSignal },
  ): Promise<void>;
};

const EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

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
      capabilities.map((capability) =>
        modelContext.registerTool(toolFor(capability), {
          signal: lifecycle.signal,
        }),
      ),
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

  function toolFor(capability: string): WebMcpTool {
    if (capability === "begin_tower_shift") {
      return {
        name: capability,
        description:
          "Connect the Tower Agent and begin the armed Shift at the current State Version.",
        inputSchema: {
          type: "object",
          properties: {
            expectedStateVersion: { type: "integer", minimum: 0 },
          },
          required: ["expectedStateVersion"],
          additionalProperties: false,
        },
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
          return result;
        },
      };
    }

    if (capability === "get_tower_snapshot") {
      return {
        name: capability,
        description:
          "Return the current compact, versioned state of the active tower Shift.",
        inputSchema: EMPTY_INPUT_SCHEMA,
        execute() {
          renewAgentLease();
          return application.query({ type: "tower-snapshot" });
        },
      };
    }

    if (capability === "wait_for_tower_event") {
      return {
        name: capability,
        description:
          "Wait for a relevant tower event or a bounded monitoring heartbeat.",
        inputSchema: {
          type: "object",
          properties: {
            cursor: { type: "integer", minimum: 0 },
            heartbeatAfterMs: { type: "integer", minimum: 1 },
          },
          required: ["cursor", "heartbeatAfterMs"],
          additionalProperties: false,
        },
        execute(input, signal) {
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
            signal,
          });
          return Promise.resolve(waiting).finally(() => {
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
        description:
          "Stage a reversible Clearance Plan for Supervising Controller review when active authority permits it.",
        inputSchema: {
          type: "object",
          properties: {
            planReference: { type: "string", minLength: 1 },
            expectedStateVersion: { type: "integer", minimum: 0 },
          },
          required: ["planReference", "expectedStateVersion"],
          additionalProperties: false,
        },
        execute(input) {
          renewAgentLease();
          const { planReference, expectedStateVersion } = input as {
            planReference: string;
            expectedStateVersion: number;
          };
          return application.command({
            type: "stage-clearance-plan",
            actor: "tower-agent",
            planReference,
            expectedStateVersion,
          });
        },
      };
    }

    return {
      name: capability,
      description: `Use the ${capability} Flow Control capability.`,
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute() {
        renewAgentLease();
        return application.query({ type: "tower-snapshot" });
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
