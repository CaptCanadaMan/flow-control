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
    expect(page).toContain(">FLOW 202</text>");
    expect(page).toContain("ARR · 3,000 ft");
    expect(page).toContain("DEP · 0 ft");
    expect(page).toContain("CCT · 1,000 ft");
  });

  it("hides out-of-play aircraft and encodes intention in the pip shape and label", () => {
    const snapshot = snapshotForRadar();
    const departed = snapshot.aircraft.find(({ id }) => id === "fc-101");
    if (!departed) {
      throw new Error("Expected FLOW 101 in the test snapshot");
    }
    departed.flightPhase = "out-of-play";
    departed.exit = "departed";

    const page = renderToStaticMarkup(<Radar snapshot={snapshot} />);

    expect(page).not.toContain('data-aircraft-id="fc-101"');
    expect(page.match(/role="button"/g)).toHaveLength(snapshot.aircraft.length - 1);
    expect(page).toContain("radar-aircraft-arrival");
    expect(page).toContain("radar-aircraft-circuit");
    expect(page).toContain('aria-label="Select FLOW 202, arrival, inbound"');
  });

  it("marks the declared emergency from the MAYDAY transmission and shows the active clearance code", () => {
    const snapshot = snapshotForRadar();
    snapshot.transmissions = [
      {
        sequence: 1,
        speaker: "pilot",
        aircraftId: "fc-303",
        text: "MAYDAY, MAYDAY, MAYDAY, FLOW 303, engine failure, requesting immediate landing.",
        simulationTimeMs: 66_000,
      },
    ];
    const emergency = snapshot.aircraft.find(({ id }) => id === "fc-303");
    if (!emergency) {
      throw new Error("Expected FLOW 303 in the test snapshot");
    }
    emergency.activeRunwayClearance = {
      kind: "clear-to-land",
      runwayId: "04-22",
      runwayEnd: "22",
    };

    const page = renderToStaticMarkup(<Radar snapshot={snapshot} />);

    expect(page).toContain("radar-aircraft-emergency");
    expect(page).toContain("radar-emergency-ring");
    expect(page).toContain("EMG · ARR · 3,500 ft · CTL 22");
    expect(page).toContain('aria-label="Select FLOW 303, arrival, inbound, emergency"');
  });

  it("overlays the selected aircraft card beside its pip", () => {
    const snapshot = snapshotForRadar();
    const page = renderToStaticMarkup(
      <Radar snapshot={snapshot} selectedAircraftId="fc-202" />,
    );

    expect(page).toContain('aria-label="Selected Aircraft FLOW 202"');
    expect(page).toContain("King Air 350");
    expect(page).toContain("3,000 ft · 180 kt · hdg 090°");
    expect(page).toContain("No active runway Clearance");
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
    expect(page).toContain("radar-aircraft-selected");
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
