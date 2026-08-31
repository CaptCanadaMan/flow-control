import type { OperatingPosture } from "../application";
import "./startup-panel.css";

export type ShiftPace = 0.75 | 1 | 1.5 | 2;

export type StartupPanelProps = {
  screenName?: string;
  pace: ShiftPace;
  operatingPosture: OperatingPosture;
  onScreenNameChange: (screenName: string) => void;
  onPaceChange: (pace: ShiftPace) => void;
  onOperatingPostureChange: (posture: OperatingPosture) => void;
  onCopyKickoffPrompt: (prompt: string) => void;
};

export type AuthorityStripProps = {
  operatingPosture: OperatingPosture;
  connectionHealth: "healthy" | "warning" | "unavailable" | "reconnected";
  stateVersion: number;
  pendingOperatingPosture?: OperatingPosture;
};

const POSTURES: Array<{
  id: OperatingPosture;
  label: string;
  authority: string;
}> = [
  {
    id: "observe",
    label: "Observe",
    authority: "Inspect live traffic and evaluate options without operational action.",
  },
  {
    id: "assist",
    label: "Assist Me",
    authority: "Stage clearance and recovery plans for your approval.",
  },
  {
    id: "take-the-sector",
    label: "Take the Sector",
    authority: "Handle delegated routine work and escalate exceptional recovery.",
  },
];

const POSTURE_LABELS: Record<OperatingPosture, string> = {
  observe: "Observe",
  assist: "Assist",
  "take-the-sector": "Take the Sector",
};

const CONNECTION_DETAILS: Record<
  AuthorityStripProps["connectionHealth"],
  { label: string; symbol: string }
> = {
  healthy: { label: "Tower Agent connected", symbol: "●" },
  warning: { label: "Tower Agent contact delayed", symbol: "!" },
  unavailable: { label: "Tower Agent unavailable", symbol: "!" },
  reconnected: { label: "Tower Agent reconnected", symbol: "✓" },
};

export function createKickoffPrompt({
  screenName,
  pace,
  operatingPosture,
}: Pick<StartupPanelProps, "screenName" | "pace" | "operatingPosture">) {
  const controller = screenName?.trim()
    ? `Supervising Controller ${screenName.trim()}`
    : "the Supervising Controller";
  const authority = {
    observe: "Inspect and evaluate only; do not stage or dispatch operational work.",
    assist:
      "Stage clearance and recovery plans for human approval; do not dispatch operational work.",
    "take-the-sector":
      "Execute authorized routine operations, notify on elevated action, and stage exceptional recovery for approval.",
  }[operatingPosture];

  return `You are the Tower Agent for Flow Control. ${controller} selected ${POSTURE_LABELS[operatingPosture]} at ${pace}× pace. ${authority} Call begin_tower_shift with expectedStateVersion 0, then continuously monitor the shared live workspace with bounded tower-event waits until the Shift completes, monitoring is revoked, or repeated tool failure prevents continuation.`;
}

export function StartupPanel({
  screenName,
  pace,
  operatingPosture,
  onScreenNameChange,
  onPaceChange,
  onOperatingPostureChange,
  onCopyKickoffPrompt,
}: StartupPanelProps) {
  const kickoffPrompt = createKickoffPrompt({
    screenName,
    pace,
    operatingPosture,
  });

  return (
    <section className="startup-panel" aria-labelledby="startup-panel-heading">
      <div className="startup-panel__heading">
        <p>Preflight</p>
        <h2 id="startup-panel-heading">Arm the shared workspace</h2>
        <p>
          Choose the delegation envelope before connecting the Tower Agent. The
          page remains authoritative for live authority.
        </p>
      </div>

      <label className="startup-panel__field" htmlFor="controller-screen-name">
        <span>Controller screen name <small>(optional)</small></span>
        <input
          id="controller-screen-name"
          name="controller-screen-name"
          type="text"
          value={screenName ?? ""}
          onChange={(event) => onScreenNameChange(event.target.value)}
          autoComplete="nickname"
          maxLength={48}
        />
      </label>

      <label className="startup-panel__field" htmlFor="shift-pace">
        <span>Shift pace</span>
        <select
          id="shift-pace"
          name="shift-pace"
          value={pace}
          onChange={(event) => onPaceChange(Number(event.target.value) as ShiftPace)}
        >
          <option value={0.75}>0.75×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5× (recommended)</option>
          <option value={2}>2×</option>
        </select>
      </label>

      <fieldset className="startup-panel__postures">
        <legend>Operating Posture</legend>
        <div className="startup-panel__posture-grid">
          {POSTURES.map((posture) => {
            const selected = posture.id === operatingPosture;
            return (
              <button
                aria-pressed={selected}
                className="startup-panel__posture"
                data-selected={selected ? "true" : undefined}
                key={posture.id}
                onClick={() => onOperatingPostureChange(posture.id)}
                type="button"
              >
                <strong>{posture.label}</strong>
                <span>{posture.authority}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="startup-panel__kickoff">
        <p>Kickoff prompt</p>
        <output aria-label="Prepared kickoff prompt">{kickoffPrompt}</output>
        <button type="button" onClick={() => onCopyKickoffPrompt(kickoffPrompt)}>
          Copy kickoff prompt
        </button>
      </div>
    </section>
  );
}

export function AuthorityStrip({
  operatingPosture,
  connectionHealth,
  stateVersion,
  pendingOperatingPosture,
}: AuthorityStripProps) {
  const connection = CONNECTION_DETAILS[connectionHealth];

  return (
    <aside className="authority-strip" aria-label="Authority and connection status">
      <span
        aria-label={`Operating Posture: ${POSTURE_LABELS[operatingPosture]}`}
        className="authority-strip__item"
      >
        <strong>Operating Posture:</strong> {POSTURE_LABELS[operatingPosture]}
      </span>
      <span
        aria-label={`Connection: ${connection.label}`}
        className={`authority-strip__item authority-strip__connection authority-strip__connection--${connectionHealth}`}
      >
        <span aria-hidden="true">{connection.symbol}</span>{" "}
        <strong>Connection:</strong> {connection.label}
      </span>
      <span aria-label={`State Version ${stateVersion}`} className="authority-strip__item">
        <strong>State Version</strong> {stateVersion}
      </span>
      {pendingOperatingPosture ? (
        <span className="authority-strip__pending">
          {POSTURE_LABELS[pendingOperatingPosture]} pending capability synchronization
        </span>
      ) : null}
    </aside>
  );
}
