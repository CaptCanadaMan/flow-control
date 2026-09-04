import { expect, it, vi } from "vitest";

import {
  createFlowControlApplication,
  type TowerSnapshot,
} from "./application";
import { connectWebMcp } from "./webmcp";

type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
  signal: AbortSignal;
};

async function connectTakeTheSector(options?: {
  wallClockNow?: () => number;
}) {
  const registeredTools: RegisteredTool[] = [];
  const application = createFlowControlApplication({
    scenarioSeed: "phase-4-issue-tools",
    operatingPosture: "take-the-sector",
    wallClockNow: options?.wallClockNow,
    connectionLease: {
      warningAfterMs: 1_000,
      unavailableAfterMs: 2_000,
    },
  });
  await connectWebMcp({
    application,
    modelContext: {
      async registerTool(tool, registration) {
        registeredTools.push({ ...tool, signal: registration.signal });
      },
    },
  });
  await registeredTools[0].execute({ expectedStateVersion: 0 });

  return {
    application,
    registeredTools,
    currentTool(name: string) {
      return registeredTools.find(
        (tool) => tool.name === name && !tool.signal.aborted,
      );
    },
  };
}

it("registers and executes complete runway and compound Tactical Instruction contracts", async () => {
  const { application, currentTool } = await connectTakeTheSector();
  const runwayTool = currentTool("issue_runway_clearance");
  const tacticalTool = currentTool("issue_tactical_instruction");

  expect(runwayTool).toMatchObject({
    description: expect.stringContaining("State Version"),
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object",
      required: ["aircraftId", "clearance", "expectedStateVersion"],
      additionalProperties: false,
      properties: {
        aircraftId: { type: "string", minLength: 1 },
        expectedStateVersion: { type: "integer", minimum: 0 },
        clearance: {
          type: "object",
          required: ["kind", "runwayId", "runwayEnd"],
          additionalProperties: false,
          properties: {
            kind: {
              enum: [
                "hold-short",
                "line-up-and-wait",
                "cancel-runway-clearance",
                "clear-for-takeoff",
                "clear-to-land",
                "clear-touch-and-go",
                "go-around",
              ],
            },
            runwayId: { enum: ["09-27", "04-22"] },
            runwayEnd: { enum: ["09", "27", "04", "22"] },
          },
          allOf: expect.arrayContaining([
            expect.objectContaining({
              if: expect.objectContaining({
                properties: { runwayId: { const: "09-27" } },
              }),
              then: expect.objectContaining({
                properties: { runwayEnd: { enum: ["09", "27"] } },
              }),
            }),
            expect.objectContaining({
              if: expect.objectContaining({
                properties: { runwayId: { const: "04-22" } },
              }),
              then: expect.objectContaining({
                properties: { runwayEnd: { enum: ["04", "22"] } },
              }),
            }),
          ]),
        },
      },
    },
  });
  expect(tacticalTool).toMatchObject({
    description: expect.stringContaining("Policy Security"),
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object",
      required: ["aircraftId", "instruction", "expectedStateVersion"],
      additionalProperties: false,
      properties: {
        aircraftId: { type: "string", minLength: 1 },
        expectedStateVersion: { type: "integer", minimum: 0 },
        instruction: {
          type: "object",
          additionalProperties: false,
          properties: {
            headingDegrees: { type: "integer", minimum: 1, maximum: 360 },
            altitudeFeet: { type: "integer", minimum: 1 },
            speedKnots: { type: "integer", minimum: 1 },
            circuit: {
              type: "object",
              required: ["action", "circuitId"],
              additionalProperties: false,
              properties: {
                action: { enum: ["enter", "adjust"] },
                circuitId: { enum: ["runway-09-left"] },
              },
            },
            sequenceBehindAircraftId: { type: "string", minLength: 1 },
            extendCircuitLeg: {
              enum: ["upwind", "crosswind", "downwind", "base"],
            },
            localHoldId: {
              enum: ["northwest-hold", "southeast-hold"],
            },
            orbitDirection: { enum: ["left", "right"] },
          },
          anyOf: [
            { required: ["headingDegrees"] },
            { required: ["altitudeFeet"] },
            { required: ["speedKnots"] },
            { required: ["circuit"] },
            { required: ["sequenceBehindAircraftId"] },
            { required: ["extendCircuitLeg"] },
            { required: ["localHoldId"] },
            { required: ["orbitDirection"] },
          ],
        },
      },
    },
  });

  expect(
    await runwayTool?.execute({
      aircraftId: "fc-101",
      clearance: {
        kind: "clear-for-takeoff",
        runwayId: "09-27",
        runwayEnd: "09",
      },
      expectedStateVersion: 1,
    }),
  ).toMatchObject({
    status: "success",
    stateVersion: 2,
    simulationTimeMs: 0,
    affectedAircraft: ["fc-101"],
    summary: expect.stringContaining("FLOW 101"),
    nextAction: "wait_for_tower_event",
  });

  expect(
    await tacticalTool?.execute({
      aircraftId: "fc-202",
      instruction: {
        headingDegrees: 120,
        altitudeFeet: 3_000,
        speedKnots: 170,
        sequenceBehindAircraftId: "fc-101",
      },
      expectedStateVersion: 2,
    }),
  ).toMatchObject({
    status: "success",
    stateVersion: 3,
    simulationTimeMs: 0,
    affectedAircraft: ["fc-202"],
    summary: expect.stringContaining(
      "heading 120, altitude 3000 feet, speed 170 knots, sequence behind fc-101",
    ),
    nextAction: "wait_for_tower_event",
  });
  const snapshot = application.query({
    type: "tower-snapshot",
  }) as TowerSnapshot;
  expect(snapshot.aircraft.find(({ id }) => id === "fc-101")).toMatchObject({
    activeRunwayClearance: { kind: "clear-for-takeoff" },
  });
  expect(snapshot.aircraft.find(({ id }) => id === "fc-202")).toMatchObject({
    activeTacticalInstruction: {
      headingDegrees: 120,
      altitudeFeet: 3_000,
      speedKnots: 170,
      sequenceBehindAircraftId: "fc-101",
    },
  });
});

it("returns canonical stale issue results and renews the connection lease", async () => {
  let wallClockTime = 0;
  const { application, currentTool } = await connectTakeTheSector({
    wallClockNow: () => wallClockTime,
  });

  wallClockTime = 900;
  expect(
    currentTool("issue_runway_clearance")?.execute({
      aircraftId: "fc-101",
      clearance: {
        kind: "clear-for-takeoff",
        runwayId: "09-27",
        runwayEnd: "09",
      },
      expectedStateVersion: 0,
    }),
  ).toMatchObject({
    status: "stale",
    stateVersion: 1,
    affectedAircraft: ["fc-101"],
    summary:
      "Runway Clearance refused because the expected State Version is stale.",
    nextAction: "get_tower_snapshot",
  });
  wallClockTime = 1_800;
  expect(application.query({ type: "connection-health" })).toEqual({
    state: "healthy",
    silenceMs: 900,
  });

  expect(
    currentTool("issue_tactical_instruction")?.execute({
      aircraftId: "fc-202",
      instruction: { headingDegrees: 120 },
      expectedStateVersion: 0,
    }),
  ).toMatchObject({
    status: "stale",
    stateVersion: 1,
    affectedAircraft: ["fc-202"],
    summary:
      "Tactical Instruction refused because the expected State Version is stale.",
    nextAction: "get_tower_snapshot",
  });
  wallClockTime = 2_700;
  expect(application.query({ type: "connection-health" })).toEqual({
    state: "healthy",
    silenceMs: 900,
  });
  expect(application.query({ type: "tower-snapshot" })).toMatchObject({
    stateVersion: 1,
    transmissions: [],
  });
});

it("lets current Policy Security refuse cached issue handles after revocation", async () => {
  const { application, registeredTools, currentTool } =
    await connectTakeTheSector();
  const runwayHandle = currentTool("issue_runway_clearance");
  const tacticalHandle = currentTool("issue_tactical_instruction");

  application.command({
    type: "reduce-operating-posture",
    actor: "supervising-controller",
    operatingPosture: "observe",
    expectedStateVersion: 1,
  });
  await vi.waitFor(() => {
    expect(runwayHandle?.signal.aborted).toBe(true);
    expect(tacticalHandle?.signal.aborted).toBe(true);
  });

  expect(
    runwayHandle?.execute({
      aircraftId: "fc-101",
      clearance: {
        kind: "clear-for-takeoff",
        runwayId: "09-27",
        runwayEnd: "09",
      },
      expectedStateVersion: 2,
    }),
  ).toMatchObject({
    status: "refusal",
    stateVersion: 2,
    affectedAircraft: ["fc-101"],
    summary: "Runway Clearance requires Take the Sector.",
  });
  expect(
    tacticalHandle?.execute({
      aircraftId: "fc-202",
      instruction: { headingDegrees: 120 },
      expectedStateVersion: 2,
    }),
  ).toMatchObject({
    status: "refusal",
    stateVersion: 2,
    affectedAircraft: ["fc-202"],
    summary: "Tactical Instruction requires Take the Sector.",
  });
  expect(application.query({ type: "tower-snapshot" })).toMatchObject({
    operatingPosture: "observe",
    stateVersion: 2,
    transmissions: [],
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
  ]);
});
