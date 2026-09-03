import { useState } from "react";

import type { TowerSnapshot } from "../application";
import type { OperationalReceiptRecord } from "./AuditPanel";
import "./LiveFeed.css";

type LiveFeedSnapshot = Pick<TowerSnapshot, "aircraft" | "transmissions">;

type FeedEntry =
  | {
      kind: "radio";
      key: string;
      simulationTimeMs: number;
      order: number;
      speaker: "controller" | "pilot";
      callsign: string;
      text: string;
    }
  | {
      kind: "tool";
      key: string;
      simulationTimeMs: number;
      order: number;
      capability: string;
      status: string;
      summary: string;
      affected: string[];
      durationMs?: number;
      input?: unknown;
    }
  | {
      kind: "event";
      key: string;
      simulationTimeMs: number;
      order: number;
      severity: "attention" | "notice";
      actor: string;
      text: string;
    };

const MONITORING_CAPABILITIES = new Set([
  "get_tower_snapshot",
  "wait_for_tower_event",
  "get_selected_context",
  "get_active_conflicts",
]);

const ATTENTION_ACTIONS = new Set([
  "emergency-declared",
  "takeoff-rejected",
  "pilot-go-around-executed",
  "pilot-unable-reported",
  "stable-flow-restored",
  "shift-completed",
]);

const NOTICE_ACTIONS = new Set([
  "recovery-plan-approved-and-dispatched",
  "clearance-plan-dispatched",
  "clearance-plan-staged",
  "recovery-plan-staged",
  "clearance-plan-invalidated",
  "recovery-plan-invalidated",
  "clearance-plan-expired",
  "recovery-plan-expired",
  "operating-posture-reduced",
  "operating-posture-increase-confirmed",
  "category-override-updated",
]);

const MAX_ENTRIES = 80;

function formatSimulationTime(simulationTimeMs: number) {
  const totalSeconds = Math.floor(simulationTimeMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function humanize(value: string) {
  const spaced = value.replaceAll("-", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function actorLabel(actor: string) {
  return actor === "supervising-controller"
    ? "Supervising Controller"
    : actor === "tower-agent"
      ? "Tower Agent"
      : actor === "simulation-clock"
        ? "Traffic"
        : humanize(actor);
}

export function LiveFeed({
  snapshot,
  receipts,
}: {
  snapshot: LiveFeedSnapshot;
  receipts: readonly OperationalReceiptRecord[];
}) {
  const [showRadio, setShowRadio] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const callsigns = new Map(
    snapshot.aircraft.map((aircraft) => [aircraft.id, aircraft.callsign]),
  );
  const callsignFor = (aircraftId: string) => callsigns.get(aircraftId) ?? aircraftId;

  let monitoringCalls = 0;
  const entries: FeedEntry[] = [];

  snapshot.transmissions.forEach((transmission, index) => {
    entries.push({
      kind: "radio",
      key: `radio-${transmission.sequence}`,
      simulationTimeMs: transmission.simulationTimeMs,
      order: index,
      speaker: transmission.speaker,
      callsign: callsignFor(transmission.aircraftId),
      text: transmission.text,
    });
  });

  receipts.forEach((receipt, index) => {
    if (receipt.action === "webmcp-tool-executed" && receipt.webMcp) {
      const capability = receipt.webMcp.capability ?? "tool";
      if (MONITORING_CAPABILITIES.has(capability)) {
        monitoringCalls += 1;
        return;
      }
      const result = receipt.webMcp.result ?? {};
      entries.push({
        kind: "tool",
        key: `tool-${index}`,
        simulationTimeMs: receipt.simulationTimeMs,
        order: index + 100_000,
        capability,
        status: result.status ?? "unknown",
        summary: result.summary ?? "",
        affected: (result.affectedAircraft ?? []).map(callsignFor),
        durationMs: receipt.webMcp.durationMs,
        input: receipt.webMcp.input,
      });
      return;
    }
    if (ATTENTION_ACTIONS.has(receipt.action) || NOTICE_ACTIONS.has(receipt.action)) {
      entries.push({
        kind: "event",
        key: `event-${index}`,
        simulationTimeMs: receipt.simulationTimeMs,
        order: index + 100_000,
        severity: ATTENTION_ACTIONS.has(receipt.action) ? "attention" : "notice",
        actor: actorLabel(receipt.actor),
        text: receipt.summary ?? humanize(receipt.action),
      });
    }
  });

  const visible = entries
    .filter((entry) =>
      entry.kind === "radio" ? showRadio : entry.kind === "tool" ? showTools : true,
    )
    .sort(
      (first, second) =>
        second.simulationTimeMs - first.simulationTimeMs || second.order - first.order,
    )
    .slice(0, MAX_ENTRIES);

  return (
    <section className="live-feed" aria-labelledby="live-feed-heading">
      <div className="live-feed-header">
        <h2 id="live-feed-heading">Live feed</h2>
        <div className="live-feed-filters" role="group" aria-label="Live feed channels">
          <button
            type="button"
            className={showRadio ? "live-feed-chip live-feed-chip-on" : "live-feed-chip"}
            aria-pressed={showRadio}
            onClick={() => setShowRadio((value) => !value)}
          >
            Radio
          </button>
          <button
            type="button"
            className={showTools ? "live-feed-chip live-feed-chip-on" : "live-feed-chip"}
            aria-pressed={showTools}
            onClick={() => setShowTools((value) => !value)}
          >
            Tool calls
          </button>
          <span className="live-feed-monitoring" aria-label={`${monitoringCalls} monitoring reads`}>
            {monitoringCalls} monitoring reads
          </span>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="live-feed-empty">
          Nothing yet. Transmissions, Tower Agent tool calls, and operational events will stream here, newest first.
        </p>
      ) : (
        <ol className="live-feed-list" aria-label="Live feed, newest first">
          {visible.map((entry) => (
            <li key={entry.key} className={`live-feed-entry live-feed-${entry.kind}${entry.kind === "radio" ? ` live-feed-${entry.speaker}` : entry.kind === "event" ? ` live-feed-${entry.severity}` : ""}`}>
              <time dateTime={`PT${Math.floor(entry.simulationTimeMs / 1_000)}S`}>
                {formatSimulationTime(entry.simulationTimeMs)}
              </time>
              {entry.kind === "radio" ? (
                <p>
                  <span className="live-feed-callsign">
                    {entry.speaker === "controller" ? "→" : "←"} {entry.callsign}
                  </span>{" "}
                  {entry.text}
                </p>
              ) : entry.kind === "tool" ? (
                <div className="live-feed-tool-body">
                  <p>
                    <span className="live-feed-pill live-feed-capability">{entry.capability}</span>{" "}
                    <span className={`live-feed-pill live-feed-status-${entry.status}`}>{entry.status}</span>
                    {entry.affected.length > 0 ? (
                      <span className="live-feed-affected"> {entry.affected.join(", ")}</span>
                    ) : null}
                    {entry.durationMs !== undefined ? (
                      <span className="live-feed-duration"> {entry.durationMs} ms</span>
                    ) : null}
                  </p>
                  {entry.summary ? <p className="live-feed-summary">{entry.summary}</p> : null}
                  {entry.input !== undefined ? (
                    <details className="live-feed-input">
                      <summary>Input</summary>
                      <code>{JSON.stringify(entry.input)}</code>
                    </details>
                  ) : null}
                </div>
              ) : (
                <p>
                  <span className="live-feed-actor">{entry.actor}</span> {entry.text}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
