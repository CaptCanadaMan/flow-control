import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFlowControlApplication, type TowerSnapshot } from "../application";
import { ActivePlanView } from "./ActivePlanView";

describe("Active Plan review", () => {
  it("offers selection, alternatives, tactical edits, and partial dispatch for a Clearance Plan", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-3-plan-review",
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
      planReference: "review-plan",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: { kind: "hold-short", runwayId: "09-27", runwayEnd: "09" },
          alternatives: [
            { kind: "line-up-and-wait", runwayId: "09-27", runwayEnd: "09" },
          ],
        },
      ],
      tacticalInstructions: [
        {
          aircraftId: "fc-202",
          instruction: { headingDegrees: 100, altitudeFeet: 3_000, speedKnots: 170 },
        },
      ],
      expectedStateVersion: 1,
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

    const page = renderToStaticMarkup(
      <ActivePlanView
        snapshot={snapshot}
        onSetMemberSelected={() => undefined}
        onSelectAlternative={() => undefined}
        onEditTacticalInstruction={() => undefined}
        onDispatchClearancePlan={() => undefined}
        onApproveRecoveryPlan={() => undefined}
      />,
    );

    expect(page).toContain("Active Plan");
    expect(page).toContain("review-plan");
    expect(page).toContain("Use line up and wait runway 09");
    expect(page).toMatch(/aria-label="Heading for FLOW 202"[^>]+value="100"/);
    expect(page).toMatch(/aria-label="Altitude for FLOW 202"[^>]+value="3000"/);
    expect(page).toMatch(/aria-label="Speed for FLOW 202"[^>]+value="170"/);
    expect(page).toContain("Apply tactical edit");
    expect(page).toContain("Dispatch 2 selected items");
  });

  it("shows an honest empty state without review controls", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-3-no-plan",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const page = renderToStaticMarkup(<ActivePlanView snapshot={snapshot} />);

    expect(page).toContain("No active plan");
    expect(page).not.toContain("Dispatch 0");
    expect(page).not.toContain("Approve &amp; dispatch");
  });
});
