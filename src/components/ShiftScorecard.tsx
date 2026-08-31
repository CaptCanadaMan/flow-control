import type { TowerSnapshot } from "../application";
import type { OperationalReceiptRecord } from "./AuditPanel";
import "./ShiftScorecard.css";

export type ShiftScorecardSnapshot =
  | Pick<TowerSnapshot, "shiftStatus" | "simulationTimeMs">
  | {
    shiftStatus: "completed" | "incomplete";
    simulationTimeMs: number;
  };

type ShiftScorecardProps = {
  snapshot: ShiftScorecardSnapshot;
  receipts: readonly OperationalReceiptRecord[];
};

function formatSimulationTime(simulationTimeMs: number) {
  const seconds = Math.floor(simulationTimeMs / 1_000);
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function statusLabel(status: ShiftScorecardSnapshot["shiftStatus"]) {
  switch (status) {
    case "completed":
      return "Completed";
    case "incomplete":
      return "Incomplete";
    case "armed":
      return "Armed";
    default:
      return "In progress";
  }
}

export function ShiftScorecard({ snapshot, receipts }: ShiftScorecardProps) {
  const towerAgentActions = receipts.filter(({ actor }) => actor === "tower-agent").length;
  const supervisingControllerActions = receipts.filter(
    ({ actor }) => actor === "supervising-controller",
  ).length;
  const approvals = receipts.filter(({ action }) => action.includes("approved")).length;
  const otherInterventions = receipts.filter(
    ({ actor, action }) => actor === "supervising-controller" && !action.includes("approved"),
  ).length;
  const refusalRecords = receipts.filter(({ action }) => action.includes("refus")).length;
  const completed = snapshot.shiftStatus === "completed";
  const incomplete = snapshot.shiftStatus === "incomplete";

  return (
    <section className="shift-scorecard" aria-labelledby="shift-scorecard-heading">
      <p>Completion evidence</p>
      <h2 id="shift-scorecard-heading">Shift Scorecard</h2>
      <p className={incomplete ? "scorecard-status scorecard-incomplete" : "scorecard-status"}>
        {statusLabel(snapshot.shiftStatus)}
      </p>
      <p>Elapsed simulation time {formatSimulationTime(snapshot.simulationTimeMs)}</p>
      <ul className="scorecard-metrics" aria-label="Receipt-backed Shift metrics">
        <li>Tower Agent actions {towerAgentActions}</li>
        <li>Supervising Controller actions {supervisingControllerActions}</li>
        <li>Approvals {approvals}</li>
        <li>Other interventions {otherInterventions}</li>
        <li>Refusal records {refusalRecords}</li>
      </ul>
      <p className="scorecard-narrative">
        {incomplete
          ? "This Shift did not reach a completed state."
          : completed
            ? `The supplied audit records ${towerAgentActions} Tower Agent action${towerAgentActions === 1 ? "" : "s"} and ${supervisingControllerActions} Supervising Controller action${supervisingControllerActions === 1 ? "" : "s"}.`
            : "This Shift remains in progress; the scorecard reflects the evidence recorded so far."}
      </p>
      <p>Response time and traffic delay were not recorded in the supplied evidence.</p>
    </section>
  );
}
