import { afterEach, describe, expect, it, vi } from "vitest";

import { createFlowControlApplication } from "./application";
import { connectWebMcp } from "./webmcp";

describe("WebMCP capability lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces the armed capability after the Tower Agent begins an Observe Shift", async () => {
    const registeredTools: Array<{
      name: string;
      execute: (input: unknown) => unknown;
      signal: AbortSignal;
    }> = [];
    const modelContext = {
      async registerTool(
        tool: { name: string; execute: (input: unknown) => unknown },
        options: { signal: AbortSignal },
      ) {
        registeredTools.push({ ...tool, signal: options.signal });
      },
    };
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });

    await connectWebMcp({ application, modelContext });

    expect(registeredTools.map(({ name }) => name)).toEqual([
      "begin_tower_shift",
    ]);

    const beginRegistration = registeredTools[0];
    await beginRegistration.execute({ expectedStateVersion: 0 });

    expect(beginRegistration.signal.aborted).toBe(true);
    expect(
      registeredTools
        .filter(({ signal }) => !signal.aborted)
        .map(({ name }) => name),
    ).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
    ]);
  });

  it("keeps the Tower Agent task alive through the registered wait capability", async () => {
    vi.useFakeTimers();
    const registeredTools = new Map<
      string,
      { execute: (input: unknown) => unknown; signal: AbortSignal }
    >();
    const modelContext = {
      async registerTool(
        tool: { name: string; execute: (input: unknown) => unknown },
        options: { signal: AbortSignal },
      ) {
        registeredTools.set(tool.name, { ...tool, signal: options.signal });
      },
    };
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    await connectWebMcp({ application, modelContext });
    await registeredTools
      .get("begin_tower_shift")
      ?.execute({ expectedStateVersion: 0 });

    const waiting = registeredTools.get("wait_for_tower_event")?.execute({
      cursor: 0,
      heartbeatAfterMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(waiting).resolves.toMatchObject({
      eventKind: "heartbeat",
      cursor: 0,
      stateVersion: 1,
      actionRequired: false,
    });
  });

  it("keeps only the armed capability registered after a stale begin call", async () => {
    const registeredTools: Array<{
      name: string;
      execute: (input: unknown) => unknown;
      signal: AbortSignal;
    }> = [];
    const modelContext = {
      async registerTool(
        tool: { name: string; execute: (input: unknown) => unknown },
        options: { signal: AbortSignal },
      ) {
        registeredTools.push({ ...tool, signal: options.signal });
      },
    };
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    await connectWebMcp({ application, modelContext });

    const beginRegistration = registeredTools[0];
    const result = await beginRegistration.execute({ expectedStateVersion: 7 });

    expect(result).toMatchObject({ status: "stale", stateVersion: 0 });
    expect(beginRegistration.signal.aborted).toBe(false);
    expect(
      registeredTools
        .filter(({ signal }) => !signal.aborted)
        .map(({ name }) => name),
    ).toEqual(["begin_tower_shift"]);
    expect(registeredTools).toHaveLength(1);
  });

  it("revokes mutation capabilities after a human reduction to Observe", async () => {
    const registeredTools: Array<{
      name: string;
      execute: (input: unknown) => unknown;
      signal: AbortSignal;
    }> = [];
    const modelContext = {
      async registerTool(
        tool: { name: string; execute: (input: unknown) => unknown },
        options: { signal: AbortSignal },
      ) {
        registeredTools.push({ ...tool, signal: options.signal });
      },
    };
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "take-the-sector",
    });
    await connectWebMcp({ application, modelContext });
    await registeredTools[0].execute({ expectedStateVersion: 0 });

    application.command({
      type: "reduce-operating-posture",
      actor: "supervising-controller",
      operatingPosture: "observe",
      expectedStateVersion: 1,
    });

    await vi.waitFor(() => {
      expect(
        registeredTools
          .filter(({ signal }) => !signal.aborted)
          .map(({ name }) => name),
      ).toEqual([
        "get_tower_snapshot",
        "wait_for_tower_event",
        "get_selected_context",
        "get_active_conflicts",
        "evaluate_clearance_set",
      ]);
    });
  });
});
