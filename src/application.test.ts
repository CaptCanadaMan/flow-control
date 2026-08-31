import { afterEach, describe, expect, it, vi } from "vitest";

import { createFlowControlApplication } from "./application";

describe("Shift lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("begins an armed Observe Shift for the connecting Tower Agent", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });

    expect(application.query({ type: "available-capabilities" })).toEqual([
      "begin_tower_shift",
    ]);

    const result = application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 1,
      summary: "Tower Agent connected; Shift phase-0 is active in Observe.",
      nextAction: "get_tower_snapshot",
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
    ]);
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      shiftStatus: "active",
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      stateVersion: 1,
    });
    expect(application.query({ type: "operational-receipts" })).toEqual([
      expect.objectContaining({
        actor: "tower-agent",
        action: "shift-began",
        stateVersionBefore: 0,
        stateVersionAfter: 1,
      }),
    ]);
  });

  it("returns a bounded heartbeat while the Tower Agent monitors an active Shift", async () => {
    vi.useFakeTimers();
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const waiting = application.query({
      type: "wait-for-tower-event",
      cursor: 0,
      heartbeatAfterMs: 1_000,
    });
    let resolved = false;
    void Promise.resolve(waiting).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(waiting).resolves.toEqual({
      eventKind: "heartbeat",
      priority: "routine",
      cursor: 0,
      stateVersion: 1,
      simulationTime: 0,
      summary: "Tower Agent monitoring is current.",
      actionRequired: false,
    });
  });

  it("publishes the active snapshot when the Tower Agent begins the Shift", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    const publishedSnapshots: unknown[] = [];
    application.subscribe((snapshot) => {
      publishedSnapshots.push(snapshot);
    });

    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(publishedSnapshots).toEqual([
      expect.objectContaining({
        shiftStatus: "active",
        stateVersion: 1,
      }),
    ]);
  });

  it("refuses a stale begin call without starting the Shift", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });

    const result = application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 7,
    });

    expect(result).toEqual({
      status: "stale",
      stateVersion: 0,
      summary: "Shift start refused because the expected State Version is stale.",
      rationale: "Expected State Version 7; current State Version is 0.",
      nextAction: "get_tower_snapshot",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      shiftStatus: "armed",
      stateVersion: 0,
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "begin_tower_shift",
    ]);
    expect(application.query({ type: "operational-receipts" })).toEqual([]);
  });

  it("refuses a cached begin call after the Shift is already active", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "refusal",
      stateVersion: 1,
      summary: "Shift start refused because the Shift is already active.",
    });
    expect(application.query({ type: "operational-receipts" })).toHaveLength(1);
  });

  it("refuses monitoring before the Shift is active", async () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });

    await expect(
      application.query({
        type: "wait-for-tower-event",
        cursor: 0,
        heartbeatAfterMs: 1,
      }),
    ).resolves.toMatchObject({
      eventKind: "monitoring-unavailable",
      stateVersion: 0,
      actionRequired: true,
    });
  });

  it("exposes delegated operational capabilities in Take the Sector", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(application.query({ type: "available-capabilities" })).toEqual([
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

  it("immediately reduces Tower Agent capability when the Supervising Controller selects Observe", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "reduce-operating-posture",
      actor: "supervising-controller",
      operatingPosture: "observe",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 2,
      summary: "Operating Posture reduced to Observe.",
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
    ]);
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      stateVersion: 2,
    });
  });

  it("keeps an authority increase pending without expanding active capability", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "reduce-operating-posture",
      actor: "supervising-controller",
      operatingPosture: "observe",
      expectedStateVersion: 1,
    });

    const result = application.command({
      type: "request-operating-posture-increase",
      actor: "supervising-controller",
      operatingPosture: "take-the-sector",
      expectedStateVersion: 2,
    });

    expect(result).toMatchObject({
      status: "approval-required",
      stateVersion: 3,
      summary: "Take the Sector grant is pending human confirmation.",
      nextAction: "confirm-operating-posture-increase",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      pendingOperatingPosture: "take-the-sector",
      stateVersion: 3,
    });
    expect(application.query({ type: "available-capabilities" })).toEqual([
      "get_tower_snapshot",
      "wait_for_tower_event",
      "get_selected_context",
      "get_active_conflicts",
      "evaluate_clearance_set",
    ]);
  });

  it("requests expanded registration only after explicit grant confirmation", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "request-operating-posture-increase",
      actor: "supervising-controller",
      operatingPosture: "take-the-sector",
      expectedStateVersion: 1,
    });

    const result = application.command({
      type: "confirm-operating-posture-increase",
      actor: "supervising-controller",
      expectedStateVersion: 2,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 3,
      summary:
        "Take the Sector grant confirmed; capability synchronization is pending.",
      nextAction: "synchronize-capabilities",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      operatingPosture: "observe",
      pendingOperatingPosture: "take-the-sector",
      capabilitySynchronization: "pending",
      stateVersion: 3,
    });
    expect(application.query({ type: "available-capabilities" })).toHaveLength(5);
    expect(
      application.query({ type: "capabilities-to-register" }),
    ).toHaveLength(9);
  });

  it("reports warning and unavailable connection states after Tower Agent silence", () => {
    let wallClockTime = 0;
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      wallClockNow: () => wallClockTime,
      connectionLease: {
        warningAfterMs: 1_000,
        unavailableAfterMs: 2_000,
      },
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    wallClockTime = 999;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "healthy",
      silenceMs: 999,
    });

    wallClockTime = 1_000;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "warning",
      silenceMs: 1_000,
    });

    wallClockTime = 2_000;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "unavailable",
      silenceMs: 2_000,
    });
  });

  it("briefly reports reconnection after contact resumes from an expired lease", () => {
    let wallClockTime = 0;
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
      wallClockNow: () => wallClockTime,
      connectionLease: {
        warningAfterMs: 1_000,
        unavailableAfterMs: 2_000,
        reconnectedForMs: 1_000,
      },
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    wallClockTime = 2_000;
    expect(application.query({ type: "connection-health" })).toMatchObject({
      state: "unavailable",
    });

    application.command({
      type: "renew-agent-lease",
      actor: "capability-registry",
    });

    expect(application.query({ type: "connection-health" })).toEqual({
      state: "reconnected",
      silenceMs: 0,
    });
    wallClockTime = 2_999;
    expect(application.query({ type: "connection-health" })).toMatchObject({
      state: "reconnected",
    });
    application.command({
      type: "renew-agent-lease",
      actor: "capability-registry",
    });
    wallClockTime = 3_000;
    expect(application.query({ type: "connection-health" })).toEqual({
      state: "healthy",
      silenceMs: 1,
    });
  });

  it("resolves an aborted tower-event wait as a semantic cancellation", async () => {
    vi.useFakeTimers();
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    const controller = new AbortController();

    const waiting = application.query({
      type: "wait-for-tower-event",
      cursor: 4,
      heartbeatAfterMs: 5_000,
      signal: controller.signal,
    });
    controller.abort();

    await expect(waiting).resolves.toMatchObject({
      eventKind: "wait-cancelled",
      cursor: 4,
      stateVersion: 1,
      actionRequired: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refuses a cached Clearance Plan mutation while active in Observe", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "phase-0-check",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "refusal",
      stateVersion: 1,
      summary: "Clearance Plan staging requires Assist or Take the Sector.",
      nextAction: "request-authority-increase",
    });
    expect(application.query({ type: "operational-receipts" })).toHaveLength(1);
  });

  it("stages a reversible Clearance Plan while active in Assist", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-0",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    const result = application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "phase-0-check",
      expectedStateVersion: 1,
    });

    expect(result).toMatchObject({
      status: "success",
      stateVersion: 2,
      summary: "Clearance Plan phase-0-check staged for human review.",
      nextAction: "await-plan-review",
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      stagedClearancePlanReference: "phase-0-check",
      stateVersion: 2,
    });
    expect(application.query({ type: "operational-receipts" })).toEqual([
      expect.objectContaining({ action: "shift-began" }),
      expect.objectContaining({
        actor: "tower-agent",
        action: "clearance-plan-staged",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
      }),
    ]);
  });
});
