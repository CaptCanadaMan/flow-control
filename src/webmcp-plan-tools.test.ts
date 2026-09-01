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

async function connectAssist() {
  const registeredTools: RegisteredTool[] = [];
  const application = createFlowControlApplication({
    scenarioSeed: "phase-4-plan-tools",
    operatingPosture: "assist",
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

it("stages a reversible Clearance Plan with strict mixed-member and alternative schemas", async () => {
  const { application, currentTool } = await connectAssist();
  const stagingTool = currentTool("stage_clearance_plan");
  const before = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

  expect(stagingTool).toMatchObject({
    description: expect.stringContaining("without dispatching"),
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object",
      required: ["planReference", "expectedStateVersion"],
      additionalProperties: false,
      anyOf: [
        { required: ["runwayClearances"] },
        { required: ["tacticalInstructions"] },
      ],
      properties: {
        planReference: { type: "string", minLength: 1 },
        expectedStateVersion: { type: "integer", minimum: 0 },
        runwayClearances: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["aircraftId", "clearance"],
            additionalProperties: false,
            properties: {
              aircraftId: { type: "string", minLength: 1 },
              clearance: expect.objectContaining({
                type: "object",
                additionalProperties: false,
              }),
              alternatives: {
                type: "array",
                minItems: 1,
                items: expect.objectContaining({
                  type: "object",
                  additionalProperties: false,
                }),
              },
            },
          },
        },
        tacticalInstructions: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["aircraftId", "instruction"],
            additionalProperties: false,
            properties: {
              aircraftId: { type: "string", minLength: 1 },
              instruction: expect.objectContaining({
                type: "object",
                additionalProperties: false,
                anyOf: expect.any(Array),
              }),
            },
          },
        },
      },
    },
  });

  const result = await stagingTool?.execute({
    planReference: "departure-and-vector",
    runwayClearances: [
      {
        aircraftId: "fc-101",
        clearance: {
          kind: "clear-for-takeoff",
          runwayId: "09-27",
          runwayEnd: "09",
        },
        alternatives: [
          {
            kind: "hold-short",
            runwayId: "09-27",
            runwayEnd: "09",
          },
        ],
      },
    ],
    tacticalInstructions: [
      {
        aircraftId: "fc-202",
        instruction: { headingDegrees: 120, speedKnots: 170 },
      },
    ],
    expectedStateVersion: 1,
  });

  expect(result).toMatchObject({
    status: "success",
    stateVersion: 2,
    simulationTimeMs: 0,
    affectedAircraft: ["fc-101", "fc-202"],
    expiresAtSimulationTimeMs: 30_000,
    nextAction: "await-plan-review",
    data: {
      reference: "departure-and-vector",
      classification: "routine",
      members: [
        expect.objectContaining({
          aircraftId: "fc-101",
          alternatives: [
            expect.objectContaining({
              clearance: expect.objectContaining({ kind: "hold-short" }),
            }),
          ],
        }),
      ],
      tacticalMembers: [
        expect.objectContaining({
          aircraftId: "fc-202",
          instruction: { headingDegrees: 120, speedKnots: 170 },
        }),
      ],
    },
  });
  const after = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
  expect(after).toMatchObject({
    transmissions: [],
  });
  expect(after.aircraft).toEqual(before.aircraft);
  expect(after.runwayResources).toEqual(before.runwayResources);
});

it("refuses a Clearance Plan whose Tactical Instruction targets an inactive aircraft", async () => {
  const { application, currentTool } = await connectAssist();

  expect(
    await currentTool("stage_clearance_plan")?.execute({
      planReference: "unknown-aircraft-vector",
      tacticalInstructions: [
        {
          aircraftId: "fc-missing",
          instruction: { headingDegrees: 120 },
        },
      ],
      expectedStateVersion: 1,
    }),
  ).toMatchObject({
    status: "refusal",
    stateVersion: 1,
    affectedAircraft: ["fc-missing"],
    summary:
      "Clearance Plan unknown-aircraft-vector cannot be staged from an invalid clearance set.",
  });
  expect(application.query({ type: "tower-snapshot" })).toMatchObject({
    stagedClearancePlan: undefined,
    transmissions: [],
    stateVersion: 1,
  });
});

it("stages an Exceptional Recovery Plan through its distinct approval boundary", async () => {
  const { application, currentTool } = await connectAssist();
  const recoveryTool = currentTool("stage_recovery_plan");

  expect(recoveryTool).toMatchObject({
    description: expect.stringContaining("explicit Supervising Controller approval"),
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object",
      required: ["planReference", "runwayClearances", "expectedStateVersion"],
      additionalProperties: false,
      properties: {
        planReference: { type: "string", minLength: 1 },
        expectedStateVersion: { type: "integer", minimum: 0 },
        runwayClearances: {
          type: "array",
          minItems: 1,
        },
      },
    },
  });

  const result = await recoveryTool?.execute({
    planReference: "go-around-recovery",
    runwayClearances: [
      {
        aircraftId: "fc-202",
        clearance: {
          kind: "go-around",
          runwayId: "04-22",
          runwayEnd: "22",
        },
      },
      {
        aircraftId: "fc-404",
        clearance: {
          kind: "hold-short",
          runwayId: "09-27",
          runwayEnd: "09",
        },
      },
    ],
    expectedStateVersion: 1,
  });

  expect(result).toMatchObject({
    status: "approval-required",
    stateVersion: 2,
    affectedAircraft: ["fc-202", "fc-404"],
    expiresAtSimulationTimeMs: 30_000,
    nextAction: "review-recovery-plan",
    data: {
      reference: "go-around-recovery",
      classification: "exceptional-recovery",
    },
  });
  expect(application.query({ type: "tower-snapshot" })).toMatchObject({
    transmissions: [],
  });
});

it("returns stale results and lets current policy refuse cached planning handles after revocation", async () => {
  const { application, registeredTools, currentTool } = await connectAssist();
  const clearanceHandle = currentTool("stage_clearance_plan");
  const recoveryHandle = currentTool("stage_recovery_plan");
  const clearanceInput = {
    planReference: "stale-plan",
    runwayClearances: [
      {
        aircraftId: "fc-101",
        clearance: {
          kind: "clear-for-takeoff",
          runwayId: "09-27",
          runwayEnd: "09",
        },
      },
    ],
    expectedStateVersion: 0,
  };

  expect(await clearanceHandle?.execute(clearanceInput)).toMatchObject({
    status: "stale",
    stateVersion: 1,
    affectedAircraft: ["fc-101"],
    summary:
      "Clearance Plan staging refused because the expected State Version is stale.",
  });

  application.command({
    type: "reduce-operating-posture",
    actor: "supervising-controller",
    operatingPosture: "observe",
    expectedStateVersion: 1,
  });
  await vi.waitFor(() => {
    expect(clearanceHandle?.signal.aborted).toBe(true);
    expect(recoveryHandle?.signal.aborted).toBe(true);
  });

  expect(
    await recoveryHandle?.execute({
      planReference: "cached-recovery",
      runwayClearances: [
        {
          aircraftId: "fc-202",
          clearance: {
            kind: "go-around",
            runwayId: "04-22",
            runwayEnd: "22",
          },
        },
      ],
      expectedStateVersion: 2,
    }),
  ).toMatchObject({
    status: "refusal",
    stateVersion: 2,
    affectedAircraft: ["fc-202"],
    summary: "Recovery Plan staging requires Assist or Take the Sector.",
  });
  expect(application.query({ type: "tower-snapshot" })).toMatchObject({
    stagedClearancePlan: undefined,
    stagedRecoveryPlan: undefined,
    stateVersion: 2,
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
