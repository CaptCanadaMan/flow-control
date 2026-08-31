import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFlowControlApplication, type TowerSnapshot } from "../application";
import { SelectedAircraftView } from "./SelectedAircraftView";

describe("SelectedAircraftView", () => {
  it("renders the selected aircraft's snapshot context and capability display type", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "selected-aircraft-view",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const selectedAircraft = snapshot.aircraft.find(
      (aircraft) => aircraft.id === "fc-202",
    );

    if (!selectedAircraft) {
      throw new Error("Expected FLOW 202 in the seeded snapshot.");
    }

    selectedAircraft.activeRunwayClearance = {
      kind: "clear-to-land",
      runwayId: "04-22",
      runwayEnd: "22",
    };
    selectedAircraft.activeTacticalInstruction = {
      headingDegrees: 220,
      altitudeFeet: 2_500,
      speedKnots: 160,
      localHoldId: "northwest-hold",
    };

    const view = renderToStaticMarkup(
      <SelectedAircraftView snapshot={snapshot} selectedAircraftId="fc-202" />,
    );

    expect(view).toContain("Selected Aircraft");
    expect(view).toContain("FLOW 202 · King Air 350");
    expect(view).toContain("Phase inbound · Arrival · Pilot Awaiting Contact");
    expect(view).toContain("Position</dt><dd>6.0 NM west · 0.0 NM north");
    expect(view).toContain("Track 090° · Heading 090°");
    expect(view).toContain("3,000 ft · 180 kt");
    expect(view).toContain("Wake medium");
    expect(view).toContain("Cleared to land runway 22");
    expect(view).toContain(
      "Heading 220° · Altitude 2,500 ft · Speed 160 kt · Hold at Northwest Hold",
    );
  });

  it("explains when no aircraft has been selected", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "selected-aircraft-empty",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

    const view = renderToStaticMarkup(<SelectedAircraftView snapshot={snapshot} />);

    expect(view).toContain("No aircraft selected");
    expect(view).toContain("Select an aircraft on the radar");
  });
});
