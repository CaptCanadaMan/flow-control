import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createFlowControlApplication,
  type TowerSnapshot,
} from "../application";
import { Radar } from "./Radar";

function snapshotForRadar() {
  const application = createFlowControlApplication({
    scenarioSeed: "radar-presentation",
    operatingPosture: "assist",
  });
  return application.query({ type: "tower-snapshot" }) as TowerSnapshot;
}

describe("Radar", () => {
  it("projects the authoritative airport geometry and every tracked aircraft into a square accessible scope", () => {
    const snapshot = snapshotForRadar();
    const page = renderToStaticMarkup(<Radar snapshot={snapshot} />);

    expect(page).toContain('viewBox="0 0 100 100"');
    expect(page).toContain('aria-label="Flow Field radar scope"');
    expect(page).toContain('data-runway-id="09-27"');
    expect(page).toContain('data-runway-id="04-22"');
    expect(page.match(/role="button"/g)).toHaveLength(snapshot.aircraft.length);
    expect(page.match(/tabindex="0"/g)).toHaveLength(snapshot.aircraft.length);
    expect(page).toContain("FLOW 202 · 3,000 ft");
  });

  it("scales runway length in nautical miles instead of stretching it across the scope", () => {
    const snapshot = snapshotForRadar();
    const page = renderToStaticMarkup(<Radar snapshot={snapshot} />);
    const primaryRunway = page.match(
      /data-runway-id="09-27" x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/,
    );

    expect(primaryRunway).not.toBeNull();
    const renderedLength = Number(primaryRunway?.[2]) - Number(primaryRunway?.[1]);
    expect(renderedLength).toBeCloseTo(9.46, 1);
  });

  it("marks the selected aircraft and exposes an accessible selection action", () => {
    const snapshot = snapshotForRadar();
    const page = renderToStaticMarkup(
      <Radar snapshot={snapshot} selectedAircraftId="fc-202" />,
    );

    expect(page).toContain('data-aircraft-id="fc-202"');
    expect(page).toContain('aria-pressed="true"');
    expect(page).toContain("radar-aircraft radar-aircraft-selected");
  });

  it("shows runway occupancy and active local hold overlays only when supplied by the snapshot", () => {
    const snapshot = snapshotForRadar();
    snapshot.runwayResources.runwayOccupancy = [
      {
        runwayId: "09-27",
        aircraftId: "fc-101",
        callsign: "FLOW 101",
        operation: "departure",
        clearsAtSimulationTimeMs: 30_000,
      },
    ];
    const aircraft = snapshot.aircraft.find(({ id }) => id === "fc-202");
    if (!aircraft) {
      throw new Error("Expected FLOW 202 in the test snapshot");
    }
    aircraft.activeTacticalInstruction = { localHoldId: "northwest-hold" };

    const page = renderToStaticMarkup(<Radar snapshot={snapshot} />);

    expect(page).toContain('aria-label="Runway 09-27 occupied by FLOW 101"');
    expect(page).toContain('aria-label="Northwest Hold active for FLOW 202"');
    expect(page).not.toContain('aria-label="Southeast Hold active');
  });

  it("renders a selected staged tactical heading as an advisory path without inventing a conflict overlay", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "radar-staged-path",
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
      planReference: "radar-heading",
      runwayClearances: [],
      tacticalInstructions: [
        { aircraftId: "fc-202", instruction: { headingDegrees: 120 } },
      ],
      expectedStateVersion: 1,
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const page = renderToStaticMarkup(<Radar snapshot={snapshot} />);

    expect(page).toContain('aria-label="Staged heading 120 for FLOW 202"');
    expect(page).toContain("radar-staged-path");
    expect(page).not.toContain("radar-conflict");
  });
});
