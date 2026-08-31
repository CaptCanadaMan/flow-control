import type { TowerSnapshot } from "../application";
import "./TransmissionHistory.css";

type TransmissionSnapshot = Pick<TowerSnapshot, "aircraft" | "transmissions">;

function formatSimulationTime(simulationTimeMs: number) {
  const totalSeconds = Math.floor(simulationTimeMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function TransmissionHistory({ snapshot }: { snapshot: TransmissionSnapshot }) {
  const callsigns = new Map(
    snapshot.aircraft.map((aircraft) => [aircraft.id, aircraft.callsign]),
  );

  return (
    <section className="transmission-history" aria-labelledby="transmission-history-heading">
      <p>Communications</p>
      <h2 id="transmission-history-heading">Transmission History</h2>
      {snapshot.transmissions.length === 0 ? (
        <p className="transmission-empty">
          No transmissions yet. Controller instructions and Pilot readbacks will appear here.
        </p>
      ) : (
        <ol className="transmission-list" aria-label="Communications history">
          {snapshot.transmissions.map((transmission) => {
            const speaker = transmission.speaker === "controller" ? "Controller" : "Pilot";
            return (
              <li key={transmission.sequence} className={`transmission ${transmission.speaker}`}>
                <div className="transmission-meta">
                  <time dateTime={`PT${Math.floor(transmission.simulationTimeMs / 1_000)}S`}>
                    {formatSimulationTime(transmission.simulationTimeMs)}
                  </time>
                  <span>{speaker} · {callsigns.get(transmission.aircraftId) ?? transmission.aircraftId}</span>
                </div>
                <p>{transmission.text}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
