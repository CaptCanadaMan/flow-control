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

  it("activates an authority grant only after expanded capability registration completes", async () => {
    let releaseRegistration: (() => void) | undefined;
    const registrationGate = new Promise<void>((resolve) => {
      releaseRegistration = resolve;
    });
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
        if (tool.name === "issue_tactical_instruction") {
          await registrationGate;
        }
      },
    };
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    await connectWebMcp({ application, modelContext });
    await registeredTools
      .find(({ name }) => name === "begin_tower_shift")
      ?.execute({ expectedStateVersion: 0 });
    application.command({
      type: "request-operating-posture-increase",
      actor: "supervising-controller",
      operatingPosture: "take-the-sector",
      expectedStateVersion: 1,
    });
    application.command({
      type: "confirm-operating-posture-increase",
      actor: "supervising-controller",
      expectedStateVersion: 2,
    });

    await vi.waitFor(() => {
      expect(
        registeredTools.some(
          ({ name }) => name === "issue_tactical_instruction",
        ),
      ).toBe(true);
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      capabilitySynchronization: "pending",
      stateVersion: 3,
    });

    releaseRegistration?.();

    await vi.waitFor(() => {
      expect(application.query({ type: "tower-snapshot" })).toMatchObject({
        operatingPosture: "take-the-sector",
        capabilitySynchronization: undefined,
        stateVersion: 4,
      });
    });
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
      "stage_clearance_plan",
      "stage_recovery_plan",
      "issue_runway_clearance",
      "issue_tactical_instruction",
    ]);
  });

  it("renews the Tower Agent connection lease when a tool is used", async () => {
    let wallClockTime = 0;
    const registeredTools = new Map<
      string,
      { execute: (input: unknown) => unknown }
    >();
    const modelContext = {
      async registerTool(
        tool: { name: string; execute: (input: unknown) => unknown },
      ) {
        registeredTools.set(tool.name, tool);
      },
    };
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      wallClockNow: () => wallClockTime,
      connectionLease: {
        warningAfterMs: 1_000,
        unavailableAfterMs: 2_000,
      },
    });
    await connectWebMcp({ application, modelContext });
    await registeredTools
      .get("begin_tower_shift")
      ?.execute({ expectedStateVersion: 0 });

    wallClockTime = 900;
    await registeredTools.get("get_tower_snapshot")?.execute({});
    wallClockTime = 1_800;

    expect(application.query({ type: "connection-health" })).toEqual({
      state: "healthy",
      silenceMs: 900,
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stateVersion: 1,
    });
  });

  it("keeps the connection healthy while a tower-event wait is pending", async () => {
    vi.useFakeTimers();
    let wallClockTime = 0;
    const registeredTools = new Map<
      string,
      { execute: (input: unknown) => unknown }
    >();
    const modelContext = {
      async registerTool(
        tool: { name: string; execute: (input: unknown) => unknown },
      ) {
        registeredTools.set(tool.name, tool);
      },
    };
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      wallClockNow: () => wallClockTime,
      connectionLease: {
        warningAfterMs: 1_000,
        unavailableAfterMs: 2_000,
      },
    });
    await connectWebMcp({ application, modelContext });
    await registeredTools
      .get("begin_tower_shift")
      ?.execute({ expectedStateVersion: 0 });

    const waiting = registeredTools.get("wait_for_tower_event")?.execute({
      cursor: 0,
      heartbeatAfterMs: 5_000,
    });
    wallClockTime = 3_000;

    expect(application.query({ type: "connection-health" })).toEqual({
      state: "healthy",
      silenceMs: 3_000,
    });

    await vi.advanceTimersByTimeAsync(5_000);
    await waiting;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "healthy",
      silenceMs: 0,
    });
  });

  it("forwards WebMCP cancellation to a pending tower-event wait", async () => {
    vi.useFakeTimers();
    const registeredTools = new Map<
      string,
      {
        execute: (input: unknown, signal?: AbortSignal) => unknown;
      }
    >();
    const modelContext = {
      async registerTool(tool: {
        name: string;
        execute: (input: unknown, signal?: AbortSignal) => unknown;
      }) {
        registeredTools.set(tool.name, tool);
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
    const controller = new AbortController();

    const waiting = registeredTools.get("wait_for_tower_event")?.execute(
      { cursor: 8, heartbeatAfterMs: 5_000 },
      controller.signal,
    );
    controller.abort();

    await expect(waiting).resolves.toMatchObject({
      eventKind: "wait-cancelled",
      cursor: 8,
      actionRequired: false,
    });
  });

  it("accepts the host execution context when forwarding wait cancellation", async () => {
    vi.useFakeTimers();
    const registeredTools = new Map<
      string,
      {
        execute: (
          input: unknown,
          context?: { signal?: AbortSignal },
        ) => unknown;
      }
    >();
    const modelContext = {
      async registerTool(tool: {
        name: string;
        execute: (
          input: unknown,
          context?: { signal?: AbortSignal },
        ) => unknown;
      }) {
        registeredTools.set(tool.name, tool);
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
    const controller = new AbortController();

    const waiting = registeredTools.get("wait_for_tower_event")?.execute(
      { cursor: 13, heartbeatAfterMs: 5_000 },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(waiting).resolves.toMatchObject({
      eventKind: "wait-cancelled",
      cursor: 13,
      actionRequired: false,
    });
  });

  it("ignores host execution context that does not contain an AbortSignal", async () => {
    vi.useFakeTimers();
    const registeredTools = new Map<
      string,
      {
        execute: (
          input: unknown,
          context?: { signal?: AbortSignal },
        ) => unknown;
      }
    >();
    const modelContext = {
      async registerTool(tool: {
        name: string;
        execute: (
          input: unknown,
          context?: { signal?: AbortSignal },
        ) => unknown;
      }) {
        registeredTools.set(tool.name, tool);
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

    const waiting = registeredTools.get("wait_for_tower_event")?.execute(
      { cursor: 21, heartbeatAfterMs: 1_000 },
      { signal: "host-context-value" as unknown as AbortSignal },
    );
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(waiting).resolves.toMatchObject({
      eventKind: "heartbeat",
      cursor: 21,
      actionRequired: false,
    });
  });

  it("routes a strict Clearance Plan tool through policy-protected staging", async () => {
    const registeredTools = new Map<
      string,
      {
        inputSchema: Record<string, unknown>;
        execute: (input: unknown) => unknown;
      }
    >();
    const modelContext = {
      async registerTool(tool: {
        name: string;
        inputSchema: Record<string, unknown>;
        execute: (input: unknown) => unknown;
      }) {
        registeredTools.set(tool.name, tool);
      },
    };
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "assist",
    });
    await connectWebMcp({ application, modelContext });
    await registeredTools
      .get("begin_tower_shift")
      ?.execute({ expectedStateVersion: 0 });

    const stagingTool = registeredTools.get("stage_clearance_plan");
    const result = await stagingTool?.execute({
      planReference: "phase-0-check",
      expectedStateVersion: 1,
    });

    expect(stagingTool?.inputSchema).toMatchObject({
      type: "object",
      required: ["planReference", "expectedStateVersion"],
      additionalProperties: false,
    });
    expect(result).toMatchObject({
      status: "success",
      stateVersion: 2,
      nextAction: "await-plan-review",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlanReference: "phase-0-check",
    });
  });
});
