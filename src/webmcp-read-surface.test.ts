import { describe, expect, it } from "vitest";

import {
  createFlowControlApplication,
  type TowerSnapshot,
} from "./application";
import { connectWebMcp } from "./webmcp";

type RegisteredTool = {
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => unknown;
};

async function connectedReadSurface(scenarioSeed: string) {
  const tools = new Map<string, RegisteredTool>();
  const application = createFlowControlApplication({
    scenarioSeed,
    operatingPosture: "observe",
  });
  await connectWebMcp({
    application,
    modelContext: {
      async registerTool(tool) {
        tools.set(tool.name, tool);
      },
    },
  });
  await tools.get("begin_tower_shift")?.execute({ expectedStateVersion: 0 });
  return { application, tools };
}

describe("Phase 4 WebMCP read surface", () => {
  it("shares the Supervising Controller selection without versioning operational state", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-4-selected-context",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "arrival-option",
      runwayClearances: [
        {
          aircraftId: "fc-202",
          clearance: {
            kind: "clear-to-land",
            runwayId: "04-22",
            runwayEnd: "04",
          },
        },
      ],
      expectedStateVersion: 1,
    });

    expect(
      application.command({
        type: "select-aircraft",
        actor: "supervising-controller",
        aircraftId: "fc-202",
      }),
    ).toEqual({
      status: "success",
      stateVersion: 2,
      summary: "FLOW 202 selected by the Supervising Controller.",
      nextAction: "continue",
    });
    expect(application.query({ type: "selected-context" })).toMatchObject({
      selectionStatus: "selected",
      selectedAircraftId: "fc-202",
      selectedAircraft: {
        id: "fc-202",
        callsign: "FLOW 202",
        flightPhase: "inbound",
        intention: "arrival",
      },
      relatedConflicts: [],
      relatedPlanMembers: [
        {
          planType: "clearance-plan",
          planReference: "arrival-option",
          memberType: "runway-clearance",
          memberId: "arrival-option:runway-clearance:1",
          selected: true,
        },
      ],
      recentTransmissions: [],
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      selectedAircraftId: "fc-202",
      stateVersion: 2,
    });
    expect(application.query({ type: "operational-receipts" })).toHaveLength(2);
  });

  it("makes invalid and out-of-play selections explicit", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-4-unavailable-selection",
      operatingPosture: "observe",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });

    expect(
      application.command({
        type: "select-aircraft",
        actor: "supervising-controller",
        aircraftId: "unknown-aircraft",
      }),
    ).toMatchObject({
      status: "refusal",
      summary: "Aircraft unknown-aircraft is not available for selection.",
    });

    application.command({
      type: "select-aircraft",
      actor: "supervising-controller",
      aircraftId: "fc-101",
    });
    application.command({
      type: "issue-runway-clearance",
      actor: "supervising-controller",
      aircraftId: "fc-101",
      clearance: {
        kind: "clear-for-takeoff",
        runwayId: "09-27",
        runwayEnd: "09",
      },
      expectedStateVersion: (
        application.query({ type: "tower-snapshot" }) as TowerSnapshot
      ).stateVersion,
    });
    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 3_500,
    });

    expect(
      (application.query({ type: "tower-snapshot" }) as TowerSnapshot).aircraft.find(
        ({ id }) => id === "fc-101",
      ),
    ).toMatchObject({ flightPhase: "out-of-play" });
    expect(application.query({ type: "selected-context" })).toMatchObject({
      selectionStatus: "unavailable",
      selectedAircraftId: "fc-101",
      selectedAircraft: undefined,
    });
  });

  it("returns selected compact snapshot sections and authoritative conflicts", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-4-application-reads",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "issue-runway-clearance",
      actor: "supervising-controller",
      aircraftId: "fc-101",
      clearance: {
        kind: "clear-for-takeoff",
        runwayId: "09-27",
        runwayEnd: "09",
      },
      expectedStateVersion: 1,
    });
    let occupiedSnapshot: TowerSnapshot;
    do {
      application.command({
        type: "advance-simulation",
        actor: "simulation-clock",
        steps: 10,
      });
      occupiedSnapshot = application.query({
        type: "tower-snapshot",
      }) as TowerSnapshot;
    } while (occupiedSnapshot.runwayResources.runwayOccupancy.length === 0);

    const snapshot = application.query({
      type: "tower-snapshot",
      sections: ["authority", "traffic"],
      detail: "compact",
    });
    expect(snapshot).toMatchObject({
      shiftStatus: "active",
      scenarioSeed: "phase-4-application-reads",
      stateVersion: occupiedSnapshot.stateVersion,
      simulationTimeMs: occupiedSnapshot.simulationTimeMs,
      authority: { operatingPosture: "assist", categoryOverrides: {} },
      traffic: {
        aircraft: expect.arrayContaining([
          expect.objectContaining({ id: "fc-202", callsign: "FLOW 202" }),
        ]),
      },
    });
    expect(snapshot).not.toHaveProperty("weather");
    expect(snapshot).not.toHaveProperty("airport");
    expect(snapshot).not.toHaveProperty("aircraftCapabilityProfiles");

    expect(
      application.query({
        type: "active-conflicts",
        scope: "all",
        detail: "full",
        lookaheadMs: 180_000,
      }),
    ).toEqual({
      asOfSimulationTimeMs: occupiedSnapshot.simulationTimeMs,
      predictionHorizonMs: 180_000,
      current: [],
      predicted: [],
    });
    expect(occupiedSnapshot.runwayResources.runwayOccupancy).toEqual([
      expect.objectContaining({ runwayId: "09-27", aircraftId: "fc-101" }),
    ]);
  });

  it("registers and executes the selective tower snapshot contract", async () => {
    const { tools } = await connectedReadSurface("phase-4-webmcp-snapshot");

    expect(tools.get("get_tower_snapshot")?.inputSchema).toEqual({
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "authority",
              "weather",
              "runways",
              "traffic",
              "plans",
              "transmissions",
            ],
          },
          minItems: 1,
          uniqueItems: true,
        },
        detail: { type: "string", enum: ["compact", "full"] },
      },
      additionalProperties: false,
    });

    const result = await tools.get("get_tower_snapshot")?.execute({
      sections: ["authority", "traffic"],
      detail: "compact",
    });
    expect(result).toMatchObject({
      status: "success",
      stateVersion: 1,
      simulationTimeMs: 0,
      affectedAircraft: [],
      summary: "Tower snapshot returned.",
      nextAction: "wait_for_tower_event",
      data: {
        authority: { operatingPosture: "observe" },
        traffic: { aircraft: expect.any(Array) },
      },
    });
    expect(result).not.toHaveProperty("data.weather");
    expect(result).not.toHaveProperty("data.runways");
  });

  it("executes selected-context and authoritative-conflict reads through common envelopes", async () => {
    const { application, tools } = await connectedReadSurface(
      "phase-4-webmcp-context",
    );
    application.command({
      type: "select-aircraft",
      actor: "supervising-controller",
      aircraftId: "fc-202",
    });

    expect(tools.get("get_selected_context")?.inputSchema).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
    expect(await tools.get("get_selected_context")?.execute({})).toMatchObject({
      status: "success",
      stateVersion: 1,
      simulationTimeMs: 0,
      affectedAircraft: ["fc-202"],
      summary: "Supervising Controller selection returned.",
      nextAction: "continue",
      data: {
        selectionStatus: "selected",
        selectedAircraftId: "fc-202",
        selectedAircraft: { callsign: "FLOW 202", flightPhase: "inbound" },
        relatedConflicts: [],
        relatedPlanMembers: [],
      },
    });

    expect(tools.get("get_active_conflicts")?.inputSchema).toEqual({
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["all", "current", "predicted"],
        },
        detail: { type: "string", enum: ["compact", "full"] },
        lookaheadMs: {
          type: "integer",
          minimum: 0,
          maximum: 600_000,
        },
      },
      additionalProperties: false,
    });
    expect(
      await tools.get("get_active_conflicts")?.execute({
        scope: "all",
        detail: "full",
        lookaheadMs: 180_000,
      }),
    ).toMatchObject({
      status: "success",
      stateVersion: 1,
      simulationTimeMs: 0,
      affectedAircraft: [],
      summary: "No current or predicted operational conflicts.",
      nextAction: "wait_for_tower_event",
      data: {
        asOfSimulationTimeMs: 0,
        predictionHorizonMs: 180_000,
        current: [],
        predicted: [],
      },
    });
  });
});
