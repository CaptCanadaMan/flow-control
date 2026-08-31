import type { OperatingPosture, TowerSnapshot } from "./application";

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
  snapshot,
  selectedAircraftId,
  onSelectAircraft,
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
  snapshot?: Pick<TowerSnapshot, "aircraft" | "airport">;
  selectedAircraftId?: string;
  onSelectAircraft?: (aircraftId: string) => void;
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

  const selectedAircraft = snapshot?.aircraft.find(
    (aircraft) => aircraft.id === selectedAircraftId,
  );

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

      {snapshot ? (
        <section className="operating-canvas" aria-label="Operating canvas">
          <svg
            className="radar"
            viewBox="0 0 100 100"
            role="img"
            aria-label={`${snapshot.airport.name} radar scope`}
          >
            <circle className="radar-boundary" cx="50" cy="50" r="40" />
            <circle className="radar-ring" cx="50" cy="50" r="20" />
            {snapshot.airport.runways.map((runway) => {
              const length = runway.role === "primary" ? 34 : 20;
              const radians = (runway.headingDegrees * Math.PI) / 180;
              const deltaX = Math.sin(radians) * length;
              const deltaY = -Math.cos(radians) * length;

              return (
                <line
                  className="runway"
                  key={runway.id}
                  x1={50 - deltaX}
                  y1={50 - deltaY}
                  x2={50 + deltaX}
                  y2={50 + deltaY}
                />
              );
            })}
            {snapshot.aircraft.map((aircraft) => {
              const x = 50 + aircraft.position.eastNauticalMiles * 5;
              const y = 50 - aircraft.position.northNauticalMiles * 5;
              const isSelected = aircraft.id === selectedAircraftId;

              return (
                <g
                  className={isSelected ? "aircraft selected" : "aircraft"}
                  key={aircraft.id}
                  aria-label={`${aircraft.callsign}, ${aircraft.flightPhase}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectAircraft?.(aircraft.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectAircraft?.(aircraft.id);
                    }
                  }}
                >
                  <circle cx={x} cy={y} r="1.65" />
                  <text x={x + 2.6} y={y - 1.8}>
                    {aircraft.callsign}
                  </text>
                </g>
              );
            })}
          </svg>

          <aside className="operational-panel" aria-label="Operational panel">
            <section aria-labelledby="situation-heading">
              <p>Situation</p>
              <h2 id="situation-heading">{snapshot.aircraft.length} aircraft tracked</h2>
              <p>{snapshot.airport.name} local control volume.</p>
            </section>
            <section aria-labelledby="selected-aircraft-heading">
              <p>Selected Aircraft</p>
              <h2 id="selected-aircraft-heading">
                {selectedAircraft?.callsign ?? "No aircraft selected"}
              </h2>
              {selectedAircraft ? (
                <p>
                  {selectedAircraft.altitudeFeet.toLocaleString()} ft · {selectedAircraft.speedKnots} kt · {selectedAircraft.flightPhase}
                </p>
              ) : (
                <p>Select an aircraft on the radar to inspect its operational context.</p>
              )}
            </section>
          </aside>
        </section>
      ) : null}

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
