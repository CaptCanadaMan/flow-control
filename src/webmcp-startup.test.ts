import { describe, expect, it } from "vitest";

import { connectStartupWebMcp, describeTower } from "./webmcp-startup";

type Registered = {
  name: string;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
  signal: AbortSignal;
};

describe("startup WebMCP capability", () => {
  it("registers describe_tower alone, read-only, before any Shift exists", async () => {
    const registered: Registered[] = [];
    await connectStartupWebMcp({
      modelContext: {
        async registerTool(tool, options) {
          registered.push({ ...tool, signal: options.signal });
        },
      },
      configuration: () => ({ screenName: "Alex", pace: 1.5, operatingPosture: "take-the-sector" }),
    });

    expect(registered.map(({ name }) => name)).toEqual(["describe_tower"]);
    expect(registered[0].annotations.readOnlyHint).toBe(true);

    const result = registered[0].execute({}) as ReturnType<typeof describeTower>;
    expect(result.status).toBe("success");
    expect(result.stateVersion).toBe(0);
    expect(result.data?.lifecycle).toBe("awaiting-arming");
    expect(result.data?.pendingConfiguration).toEqual({
      screenName: "Alex",
      pace: 1.5,
      operatingPosture: "take-the-sector",
    });
    expect(result.data?.webMcp.capabilitiesAfterArming).toEqual(["begin_tower_shift"]);
    expect(result.nextAction).toContain("begin_tower_shift");
  });

  it("reads the live configuration at call time and is revoked by revoke()", async () => {
    const registered: Registered[] = [];
    let pace = 1;
    const connection = await connectStartupWebMcp({
      modelContext: {
        async registerTool(tool, options) {
          registered.push({ ...tool, signal: options.signal });
        },
      },
      configuration: () => ({ pace, operatingPosture: "observe" }),
    });

    pace = 2;
    const result = registered[0].execute({}) as ReturnType<typeof describeTower>;
    expect(result.data?.pendingConfiguration.pace).toBe(2);

    expect(registered[0].signal.aborted).toBe(false);
    connection.revoke();
    expect(registered[0].signal.aborted).toBe(true);
  });
});
