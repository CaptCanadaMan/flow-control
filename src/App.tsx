import type { OperatingPosture } from "./application";

const POSTURE_LABELS: Record<OperatingPosture, string> = {
  observe: "Observe",
  assist: "Assist",
  "take-the-sector": "Take the Sector",
};

export function App({
  webMcpAvailable,
  shiftStatus = "armed",
  stateVersion = 0,
  operatingPosture = "observe",
  onReduceToObserve,
}: {
  webMcpAvailable: boolean;
  shiftStatus?: "armed" | "active";
  stateVersion?: number;
  operatingPosture?: OperatingPosture;
  onReduceToObserve?: () => void;
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
          <h2 id="monitoring">Monitoring loop ready</h2>
          <p>
            Snapshot reads and bounded tower-event heartbeats are available to
            the connected Tower Agent.
          </p>
          {operatingPosture === "take-the-sector" ? (
            <button type="button" onClick={onReduceToObserve}>
              Reduce to Observe
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
