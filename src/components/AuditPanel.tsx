import "./AuditPanel.css";

export type OperationalReceiptRecord = {
  actor: string;
  action: string;
  simulationTimeMs: number;
  stateVersionBefore: number;
  stateVersionAfter: number;
  /** A concise declared operational outcome, never private model reasoning. */
  summary?: string;
};

type AuditPanelProps = {
  receipts: readonly OperationalReceiptRecord[];
  onExport?: () => void;
};

function formatSimulationTime(simulationTimeMs: number) {
  const seconds = Math.floor(simulationTimeMs / 1_000);
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function actorLabel(actor: string) {
  return actor
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function actionLabel(action: string) {
  return action.replaceAll("-", " ");
}

export function AuditPanel({ receipts, onExport }: AuditPanelProps) {
  const recordLabel = `${receipts.length} ${receipts.length === 1 ? "record" : "records"}`;

  return (
    <section className="audit-panel" aria-labelledby="audit-panel-heading">
      <p>Audit</p>
      <h2 id="audit-panel-heading">Operational Receipts</h2>
      {receipts.length === 0 ? (
        <p>No Operational Receipts have been recorded in this Shift.</p>
      ) : (
        <details className="audit-disclosure">
          <summary>Inspect {recordLabel}</summary>
          <ol className="audit-records">
            {receipts.map((receipt, index) => (
              <li key={`${receipt.stateVersionAfter}-${receipt.action}-${index}`}>
                <div className="audit-record-meta">
                  <time dateTime={`PT${Math.floor(receipt.simulationTimeMs / 1_000)}S`}>
                    {formatSimulationTime(receipt.simulationTimeMs)}
                  </time>
                  <span>{actorLabel(receipt.actor)} · {actionLabel(receipt.action)}</span>
                </div>
                <p>State Version {receipt.stateVersionBefore} → {receipt.stateVersionAfter}</p>
                {receipt.summary ? <p>{receipt.summary}</p> : null}
              </li>
            ))}
          </ol>
          {onExport ? (
            <button type="button" onClick={onExport}>Export JSON</button>
          ) : null}
        </details>
      )}
    </section>
  );
}
