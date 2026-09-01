import { expect, it, vi } from "vitest";

import {
  createFlowControlApplication,
  type TowerSnapshot,
} from "./application";
import { connectWebMcp } from "./webmcp";

type RegisteredTool = {
  name: string;
  execute: (input: unknown) => unknown;
  signal: AbortSignal;
};

async function connectTakeTheSector(clock: () => number) {
  const tools: RegisteredTool[] = [];
  const application = createFlowControlApplication({
    scenarioSeed: "phase-4-monitoring-audit",
    operatingPosture: "take-the-sector",
    wallClockNow: clock,
  });
  await connectWebMcp({
    application,
    wallClockNow: clock,
    modelContext: {
      async registerTool(tool, registration) {
        tools.push({ ...tool, signal: registration.signal });
      },
    },
  });
  const currentTool = (name: string) =>
    tools.find((tool) => tool.name === name && !tool.signal.aborted);
  await currentTool("begin_tower_shift")?.execute({ expectedStateVersion: 0 });
  return { application, currentTool };
}

it("records compact WebMCP input, result, actor, authority, versions, and timing", async () => {
  let wallClockTime = 100;
  const { application, currentTool } = await connectTakeTheSector(
    () => wallClockTime,
  );

  wallClockTime = 125;
  await currentTool("get_tower_snapshot")?.execute({
    sections: ["authority"],
    detail: "compact",
  });
  wallClockTime = 150;
  await currentTool("issue_runway_clearance")?.execute({
    aircraftId: "fc-101",
    clearance: {
      kind: "clear-for-takeoff",
      runwayId: "09-27",
      runwayEnd: "09",
    },
    expectedStateVersion: 0,
  });

  const auditRecords = (
    application.query({ type: "operational-receipts" }) as Array<
      Record<string, unknown>
    >
  ).filter(({ action }) => action === "webmcp-tool-executed");
  expect(auditRecords).toHaveLength(3);
  expect(auditRecords[1]).toMatchObject({
    actor: "tower-agent",
    action: "webmcp-tool-executed",
    simulationTimeMs: 0,
    stateVersionBefore: 1,
    stateVersionAfter: 1,
    webMcp: {
      capability: "get_tower_snapshot",
      input: { sections: ["authority"], detail: "compact" },
      result: {
        status: "success",
        stateVersion: 1,
        summary: "Tower snapshot returned.",
        nextAction: "wait_for_tower_event",
      },
      actor: "tower-agent",
      authority: {
        operatingPosture: "take-the-sector",
        categoryOverrides: {},
      },
      startedAtWallClockMs: 125,
      durationMs: 0,
    },
  });
  expect(auditRecords[2]).toMatchObject({
    stateVersionBefore: 1,
    stateVersionAfter: 1,
    webMcp: {
      capability: "issue_runway_clearance",
      result: {
        status: "stale",
        affectedAircraft: ["fc-101"],
        summary:
          "Runway Clearance refused because the expected State Version is stale.",
      },
      startedAtWallClockMs: 150,
    },
  });
  expect(JSON.stringify(auditRecords)).not.toContain("data");
  expect(JSON.stringify(auditRecords)).not.toContain("reasoning");
  expect(
    (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
      .eventCursor,
  ).toBe(0);
});

it("wakes a cursor wait on the next operational event and then returns a bounded heartbeat", async () => {
  vi.useFakeTimers();
  const application = createFlowControlApplication({
    scenarioSeed: "phase-4-event-cursor",
    operatingPosture: "take-the-sector",
  });
  application.command({
    type: "begin-shift",
    actor: "tower-agent",
    expectedStateVersion: 0,
  });
  expect(
    (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
      .eventCursor,
  ).toBe(0);

  const waiting = application.query({
    type: "wait-for-tower-event",
    cursor: 0,
    heartbeatAfterMs: 5_000,
  });
  application.command({
    type: "set-category-override",
    actor: "supervising-controller",
    category: "runway-clearance",
    disposition: "withheld",
    expectedStateVersion: 1,
  });

  await expect(waiting).resolves.toEqual({
    eventKind: "category-override-updated",
    priority: "attention",
    cursor: 1,
    stateVersion: 2,
    simulationTime: 0,
    summary: "Category override updated.",
    actionRequired: true,
  });
  expect(
    (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
      .eventCursor,
  ).toBe(1);

  const heartbeat = application.query({
    type: "wait-for-tower-event",
    cursor: 1,
    heartbeatAfterMs: 1_000,
  });
  await vi.advanceTimersByTimeAsync(1_000);
  await expect(heartbeat).resolves.toMatchObject({
    eventKind: "heartbeat",
    cursor: 1,
    stateVersion: 2,
    simulationTime: 0,
    actionRequired: false,
  });
});

it("returns a pending event immediately through the compact WebMCP wait envelope", async () => {
  let wallClockTime = 0;
  const { application, currentTool } = await connectTakeTheSector(
    () => wallClockTime,
  );
  application.command({
    type: "set-category-override",
    actor: "supervising-controller",
    category: "tactical-instruction",
    disposition: "withheld",
    expectedStateVersion: 1,
  });

  wallClockTime = 25;
  await expect(
    currentTool("wait_for_tower_event")?.execute({
      cursor: 0,
      heartbeatAfterMs: 1_000,
    }),
  ).resolves.toMatchObject({
    status: "success",
    stateVersion: 2,
    simulationTimeMs: 0,
    affectedAircraft: [],
    summary: "Category override updated.",
    nextAction: "wait_for_tower_event",
    data: {
      eventKind: "category-override-updated",
      priority: "attention",
      cursor: 1,
      stateVersion: 2,
      simulationTime: 0,
      actionRequired: true,
    },
  });
});
