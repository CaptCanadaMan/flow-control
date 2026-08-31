import type { FlowControlApplication } from "./application";

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => unknown;
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
  let lifecycle = new AbortController();
  let capabilityKey = "";
  let pendingSynchronization = Promise.resolve();

  async function registerCurrentCapabilities() {
    const capabilities = application.query({
      type: "available-capabilities",
    }) as string[];

    await Promise.all(
      capabilities.map((capability) =>
        modelContext.registerTool(toolFor(capability), {
          signal: lifecycle.signal,
        }),
      ),
    );
    capabilityKey = capabilities.join("|");
  }

  async function synchronizeCapabilities() {
    const capabilities = application.query({
      type: "available-capabilities",
    }) as string[];
    const nextCapabilityKey = capabilities.join("|");

    if (nextCapabilityKey === capabilityKey) {
      return;
    }

    lifecycle.abort();
    lifecycle = new AbortController();
    await registerCurrentCapabilities();
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
        execute(input) {
          const { cursor, heartbeatAfterMs } = input as {
            cursor: number;
            heartbeatAfterMs: number;
          };
          return application.query({
            type: "wait-for-tower-event",
            cursor,
            heartbeatAfterMs,
          });
        },
      };
    }

    return {
      name: capability,
      description: `Use the ${capability} Flow Control capability.`,
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute() {
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
      lifecycle.abort();
    },
  };
}
