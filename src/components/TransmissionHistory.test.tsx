import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFlowControlApplication, type TowerSnapshot } from "../application";
import { TransmissionHistory } from "./TransmissionHistory";

describe("TransmissionHistory", () => {
  it("renders communications with speaker text, callsign, and simulation time", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "transmission-history",
      operatingPosture: "take-the-sector",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "issue-runway-clearance",
      actor: "tower-agent",
      expectedStateVersion: 1,
      aircraftId: "fc-101",
      clearance: { kind: "hold-short", runwayId: "09-27", runwayEnd: "09" },
    });
    application.command({
      type: "advance-simulation",
      actor: "simulation-clock",
      steps: 10,
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

    const view = renderToStaticMarkup(<TransmissionHistory snapshot={snapshot} />);

    expect(view).toContain("Transmission History");
    expect(view).toContain("00:00");
    expect(view).toContain("Controller · FLOW 101");
    expect(view).toContain("Pilot · FLOW 101");
    expect(view).toContain("FLOW 101, hold short runway 09.");
  });

  it("renders an honest empty state when the snapshot has no communications", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "transmission-history-empty",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

    const view = renderToStaticMarkup(<TransmissionHistory snapshot={snapshot} />);

    expect(view).toContain("No transmissions yet.");
    expect(view).toContain("Controller instructions and Pilot readbacks will appear here.");
  });
});
