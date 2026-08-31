import type { OperatingPosture } from "./application";

const POSTURE_LABELS: Record<OperatingPosture, string> = {
  observe: "Observe",
  assist: "Assist",
  "take-the-sector": "Take the Sector",
};

export type ConnectionHealth =
  | "healthy"
  | "warning"
  | "unavailable"
  | "reconnected";

export function App({
  webMcpAvailable,
  shiftStatus = "armed",
  stateVersion = 0,
  operatingPosture = "observe",
  pendingOperatingPosture,
  capabilitySynchronization,
  connectionHealth = "healthy",
  stagedClearancePlanReference,
  onReduceToObserve,
  onRequestTakeTheSector,
  onConfirmTakeTheSector,
}: {
  webMcpAvailable: boolean;
  shiftStatus?: "armed" | "active";
  stateVersion?: number;
  operatingPosture?: OperatingPosture;
  pendingOperatingPosture?: OperatingPosture;
  capabilitySynchronization?: "awaiting-confirmation" | "pending";
  connectionHealth?: ConnectionHealth;
  stagedClearancePlanReference?: string;
  onReduceToObserve?: () => void;
  onRequestTakeTheSector?: () => void;
  onConfirmTakeTheSector?: () => void;
}) {
  if (!webMcpAvailable) {
    return (
      <main>
        <p>Flow Control compatibility check</p>
        <h1>WebMCP is not available</h1>
        <p>
          Reopen Flow Control in the ChatGPT in-app browser, or use Chrome 149+
          with WebMCP testing enabled.
        </p>
      </main>
    );
  }

  return (
    <main>
      <header>
        <p>Flow Control · orchestration spike</p>
        <h1>Supervise autonomy from one shared live workspace.</h1>
        <p>
          A Tower Agent handles delegated work while the Supervising Controller
          retains authority, exceptional judgment, and an inspectable record.
        </p>
      </header>

      {shiftStatus === "active" && connectionHealth !== "healthy" ? (
        connectionHealth === "warning" ? (
          <aside className="connection-banner warning" role="status">
            <strong>Tower Agent contact delayed</strong>
            <span> Traffic continues while Flow Control waits for contact.</span>
          </aside>
        ) : connectionHealth === "unavailable" ? (
          <aside className="connection-banner unavailable" role="alert">
            <strong>Tower Agent unavailable</strong>
            <span>
              {" "}
              Traffic continues and Supervising Controller controls remain
              available.
            </span>
          </aside>
        ) : (
          <aside className="connection-banner reconnected" role="status">
            <strong>Tower Agent reconnected</strong>
            <span> Monitoring contact has resumed.</span>
          </aside>
        )
      ) : null}

      <section aria-labelledby="shift-status">
        <p>WebMCP ready</p>
        <h2 id="shift-status">
          {shiftStatus === "armed" ? "Shift armed" : "Tower Agent connected"}
        </h2>
        {shiftStatus === "armed" ? (
          <p>
            Traffic remains paused until the Tower Agent connects. Current
            Operating Posture: <strong>{POSTURE_LABELS[operatingPosture]}</strong>.
          </p>
        ) : (
          <p>
            Shift active in <strong>{POSTURE_LABELS[operatingPosture]}</strong> · State Version {stateVersion}
          </p>
        )}
      </section>

      {shiftStatus === "armed" ? (
        <section aria-labelledby="connect-agent">
          <h2 id="connect-agent">Connect the Tower Agent</h2>
          <p>Ask the browser agent to call:</p>
          <code>begin_tower_shift({`{"expectedStateVersion":0}`})</code>
        </section>
      ) : (
        <section aria-labelledby="monitoring">
          <h2 id="monitoring">
            {capabilitySynchronization === "awaiting-confirmation"
              ? "Authority grant pending"
              : capabilitySynchronization === "pending"
                ? "Synchronizing capabilities"
                : "Monitoring loop ready"}
          </h2>
          <p>
            {pendingOperatingPosture
              ? `${POSTURE_LABELS[pendingOperatingPosture]} is not active yet. Observe remains authoritative until confirmation and capability synchronization complete.`
              : "Snapshot reads and bounded tower-event heartbeats are available to the connected Tower Agent."}
          </p>
          {stagedClearancePlanReference ? (
            <div className="staged-plan" role="status">
              <strong>Clearance Plan staged</strong>
              <code>{stagedClearancePlanReference}</code>
            </div>
          ) : null}
          {capabilitySynchronization === "awaiting-confirmation" ? (
            <button type="button" onClick={onConfirmTakeTheSector}>
              Confirm Take the Sector
            </button>
          ) : capabilitySynchronization === "pending" ? null : operatingPosture ===
            "take-the-sector" ? (
            <button type="button" onClick={onReduceToObserve}>
              Reduce to Observe
            </button>
          ) : operatingPosture === "observe" ? (
            <button type="button" onClick={onRequestTakeTheSector}>
              Request Take the Sector
            </button>
          ) : null}
        </section>
      )}

      <footer>
        Illustrative simulation only — not for operational air traffic control.
      </footer>
    </main>
  );
}
