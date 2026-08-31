import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OperationalReceiptRecord } from "./AuditPanel";
import { ShiftScorecard } from "./ShiftScorecard";

const receipts: OperationalReceiptRecord[] = [
  {
    actor: "tower-agent",
    action: "clearance-plan-staged",
    simulationTimeMs: 5_000,
    stateVersionBefore: 1,
    stateVersionAfter: 2,
  },
  {
    actor: "supervising-controller",
    action: "recovery-plan-approved-and-dispatched",
    simulationTimeMs: 12_000,
    stateVersionBefore: 2,
    stateVersionAfter: 3,
  },
  {
    actor: "supervising-controller",
    action: "operating-posture-reduced",
    simulationTimeMs: 14_000,
    stateVersionBefore: 3,
    stateVersionAfter: 4,
  },
  {
    actor: "policy-engine",
    action: "clearance-refused",
    simulationTimeMs: 16_000,
    stateVersionBefore: 4,
    stateVersionAfter: 4,
  },
];

describe("ShiftScorecard", () => {
  it("reports only receipt-backed delegation, approval, intervention, and refusal evidence", () => {
    const view = renderToStaticMarkup(
      <ShiftScorecard
        snapshot={{ shiftStatus: "completed", simulationTimeMs: 16_000 }}
        receipts={receipts}
      />,
    );

    expect(view).toContain("Shift Scorecard");
    expect(view).toContain("Completed");
    expect(view).toContain("Elapsed simulation time 00:16");
    expect(view).toContain("Tower Agent actions 1");
    expect(view).toContain("Supervising Controller actions 2");
    expect(view).toContain("Approvals 1");
    expect(view).toContain("Other interventions 1");
    expect(view).toContain("Refusal records 1");
    expect(view).toContain("Response time and traffic delay were not recorded in the supplied evidence.");
  });

  it("labels a stopped Shift incomplete without presenting it as a successful result", () => {
    const view = renderToStaticMarkup(
      <ShiftScorecard
        snapshot={{ shiftStatus: "incomplete", simulationTimeMs: 72_000 }}
        receipts={[]}
      />,
    );

    expect(view).toContain("Incomplete");
    expect(view).toContain("This Shift did not reach a completed state.");
    expect(view).not.toContain("Stable Flow achieved");
  });
});
