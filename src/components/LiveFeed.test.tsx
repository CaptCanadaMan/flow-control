import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFlowControlApplication, type TowerSnapshot } from "../application";
import { LiveFeed } from "./LiveFeed";

function snapshotForFeed() {
  const application = createFlowControlApplication({
    scenarioSeed: "live-feed",
    operatingPosture: "take-the-sector",
  });
  return application.query({ type: "tower-snapshot" }) as TowerSnapshot;
}

describe("LiveFeed", () => {
  it("streams radio, Tower Agent tool calls, and attention events newest first", () => {
    const snapshot = snapshotForFeed();
    snapshot.transmissions = [
      {
        sequence: 1,
        speaker: "controller",
        aircraftId: "fc-202",
        text: "FLOW 202, cleared to land runway 04.",
        simulationTimeMs: 12_000,
      },
      {
        sequence: 2,
        speaker: "pilot",
        aircraftId: "fc-202",
        text: "FLOW 202, cleared to land runway 04.",
        simulationTimeMs: 13_000,
      },
    ];
    const page = renderToStaticMarkup(
      <LiveFeed
        snapshot={snapshot}
        receipts={[
          {
            actor: "tower-agent",
            action: "webmcp-tool-executed",
            simulationTimeMs: 12_000,
            stateVersionBefore: 3,
            stateVersionAfter: 4,
            webMcp: {
              capability: "issue_runway_clearance",
              input: { aircraftId: "fc-202" },
              result: {
                status: "success",
                summary: "FLOW 202, cleared to land runway 04. Pilot readback is pending.",
                affectedAircraft: ["fc-202"],
              },
              durationMs: 4,
            },
          },
          {
            actor: "tower-agent",
            action: "webmcp-tool-executed",
            simulationTimeMs: 14_000,
            stateVersionBefore: 5,
            stateVersionAfter: 5,
            webMcp: {
              capability: "wait_for_tower_event",
              result: { status: "success", summary: "Tower event wait completed." },
              durationMs: 1_000,
            },
          },
          {
            actor: "simulation-clock",
            action: "emergency-declared",
            simulationTimeMs: 66_000,
            stateVersionBefore: 9,
            stateVersionAfter: 10,
            summary: "FLOW 303 declared an emergency inbound and requires priority handling.",
          },
        ]}
      />,
    );

    const emergencyIndex = page.indexOf("declared an emergency");
    const pilotIndex = page.indexOf("← FLOW 202");
    const controllerIndex = page.indexOf("→ FLOW 202");
    expect(emergencyIndex).toBeGreaterThan(-1);
    expect(emergencyIndex).toBeLessThan(pilotIndex);
    expect(pilotIndex).toBeLessThan(controllerIndex);
    expect(page).toContain("issue_runway_clearance");
    expect(page).toContain("live-feed-status-success");
    expect(page).toContain("4 ms");
    expect(page).toContain("1 monitoring reads");
    expect(page).not.toContain("wait_for_tower_event");
    expect(page).toContain("live-feed-attention");
  });

  it("explains an empty stream", () => {
    const page = renderToStaticMarkup(
      <LiveFeed snapshot={snapshotForFeed()} receipts={[]} />,
    );

    expect(page).toContain("Nothing yet");
    expect(page).toContain("0 monitoring reads");
  });
});
