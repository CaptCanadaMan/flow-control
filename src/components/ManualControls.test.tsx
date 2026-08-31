import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFlowControlApplication, type TowerSnapshot } from "../application";
import { ManualControls } from "./ManualControls";

describe("ManualControls", () => {
  it("renders structured runway and tactical controls for the selected aircraft", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "manual-controls",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const aircraft = snapshot.aircraft.find((candidate) => candidate.id === "fc-202");

    if (!aircraft) {
      throw new Error("Expected FLOW 202 in the seeded snapshot.");
    }

    const view = renderToStaticMarkup(
      <ManualControls
        selectedAircraft={aircraft}
        aircraft={snapshot.aircraft}
        onIssueRunwayClearance={() => undefined}
        onIssueTacticalInstruction={() => undefined}
      />,
    );

    expect(view).toContain("Manual Controls");
    expect(view).toContain("Issue a structured instruction to FLOW 202.");
    expect(view).toContain('name="runway-clearance-kind"');
    expect(view).toContain("Clear to land");
    expect(view).toContain('name="runway-resource"');
    expect(view).toContain('name="heading-degrees"');
    expect(view).toContain('name="altitude-feet"');
    expect(view).toContain('name="speed-knots"');
    expect(view).toContain('name="local-hold"');
    expect(view).toContain('name="orbit-direction"');
    expect(view).not.toContain('type="text"');
  });

  it("keeps both controlled forms unavailable without a selected aircraft", () => {
    const view = renderToStaticMarkup(
      <ManualControls
        aircraft={[]}
        onIssueRunwayClearance={() => undefined}
        onIssueTacticalInstruction={() => undefined}
      />,
    );

    expect(view).toContain("No aircraft selected");
    expect(view).toContain("Select an aircraft to issue a structured manual instruction.");
    expect(view.match(/disabled=""/g)).toHaveLength(2);
  });

  it("explains when manual dispatch callbacks are unavailable", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "manual-controls-unavailable",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

    const view = renderToStaticMarkup(
      <ManualControls selectedAircraft={snapshot.aircraft[0]} aircraft={snapshot.aircraft} />,
    );

    expect(view).toContain("Manual dispatch is unavailable while the workspace reconnects.");
    expect(view.match(/disabled=""/g)).toHaveLength(2);
  });
});
