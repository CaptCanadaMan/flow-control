import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFlowControlApplication, type TowerSnapshot } from "../application";
import { CommandBar } from "./CommandBar";

function aircraftForBar() {
  const application = createFlowControlApplication({
    scenarioSeed: "command-bar",
    operatingPosture: "take-the-sector",
  });
  return (application.query({ type: "tower-snapshot" }) as TowerSnapshot).aircraft;
}

describe("CommandBar", () => {
  it("offers every runway Clearance and Tactical Instruction verb as a tap target for the selected aircraft", () => {
    const aircraft = aircraftForBar();
    const page = renderToStaticMarkup(
      <CommandBar
        selectedAircraft={aircraft.find(({ id }) => id === "fc-202")}
        aircraft={aircraft}
        onIssueRunwayClearance={() => undefined}
        onIssueTacticalInstruction={() => undefined}
      />,
    );

    expect(page).toContain("FLOW 202");
    for (const verb of [
      "Land",
      "Takeoff",
      "Touch-and-go",
      "Line up",
      "Hold short",
      "Cancel",
      "Go around",
      "Climb",
      "Descend",
      "Turn L",
      "Turn R",
      "Speed",
      "Hold NW",
      "Hold SE",
      "Orbit L",
      "Orbit R",
      "Enter circuit",
      "Extend leg",
      "Sequence behind",
    ]) {
      expect(page).toContain(`>${verb}</button>`);
    }
    expect(page).toContain("Tap an action, then a value");
    expect(page).not.toContain('type="text"');
    expect(page).not.toContain('type="number"');
    expect(page).not.toContain("<select");
  });

  it("disables every verb and Send until an aircraft is selected", () => {
    const page = renderToStaticMarkup(
      <CommandBar
        aircraft={aircraftForBar()}
        onIssueRunwayClearance={() => undefined}
        onIssueTacticalInstruction={() => undefined}
      />,
    );

    expect(page).toContain("Tap an aircraft on the radar to command it.");
    expect(page.match(/disabled=""/g)?.length ?? 0).toBeGreaterThanOrEqual(20);
  });
});
