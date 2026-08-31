import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuditPanel, type OperationalReceiptRecord } from "./AuditPanel";

const receipts: OperationalReceiptRecord[] = [
  {
    actor: "tower-agent",
    action: "clearance-plan-staged",
    simulationTimeMs: 12_500,
    stateVersionBefore: 3,
    stateVersionAfter: 4,
    summary: "Staged a departure sequence for review.",
  },
];

describe("AuditPanel", () => {
  it("keeps concise Operational Receipts on demand and offers a native JSON export action", () => {
    const view = renderToStaticMarkup(
      <AuditPanel receipts={receipts} onExport={() => undefined} />,
    );

    expect(view).toContain("Operational Receipts");
    expect(view).toContain("1 record");
    expect(view).toContain("00:12");
    expect(view).toContain("Tower Agent · clearance plan staged");
    expect(view).toContain("State Version 3 → 4");
    expect(view).toContain("Staged a departure sequence for review.");
    expect(view).toContain('<details class="audit-disclosure">');
    expect(view).toContain('<button type="button">Export JSON</button>');
  });

  it("explains when the current Shift has no inspectable records", () => {
    const view = renderToStaticMarkup(<AuditPanel receipts={[]} />);

    expect(view).toContain("No Operational Receipts have been recorded in this Shift.");
    expect(view).not.toContain("Export JSON");
  });
});
