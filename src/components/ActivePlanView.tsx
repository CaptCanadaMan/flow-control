import type { TowerSnapshot } from "../application";
import "./ActivePlanView.css";

const CLASSIFICATION_LABELS = {
  routine: "Routine",
  elevated: "Elevated",
  "exceptional-recovery": "Exceptional Recovery",
} as const;

const CLEARANCE_LABELS = {
  "hold-short": "hold short",
  "line-up-and-wait": "line up and wait",
  "cancel-runway-clearance": "cancel runway clearance",
  "clear-for-takeoff": "cleared for takeoff",
  "clear-to-land": "cleared to land",
  "clear-touch-and-go": "cleared touch-and-go",
  "go-around": "go around",
} as const;

type ActivePlanSnapshot = Pick<
  TowerSnapshot,
  "aircraft" | "stagedClearancePlan" | "stagedRecoveryPlan"
>;

type TacticalChanges = {
  headingDegrees?: number;
  altitudeFeet?: number;
  speedKnots?: number;
};

export type ActivePlanViewProps = {
  snapshot: ActivePlanSnapshot;
  onSetMemberSelected?: (memberId: string, selected: boolean) => void;
  onSelectAlternative?: (memberId: string, alternativeId: string) => void;
  onEditTacticalInstruction?: (memberId: string, changes: TacticalChanges) => void;
  onDispatchClearancePlan?: () => void;
  onApproveRecoveryPlan?: () => void;
};

function formatSimulationTime(simulationTimeMs: number) {
  const totalSeconds = Math.floor(simulationTimeMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clearanceSummary(clearance: {
  kind: keyof typeof CLEARANCE_LABELS;
  runwayEnd: string;
}) {
  return `${CLEARANCE_LABELS[clearance.kind]} runway ${clearance.runwayEnd}`;
}

function numberFromForm(form: FormData, name: string) {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw.trim() === "") {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function ActivePlanView({
  snapshot,
  onSetMemberSelected,
  onSelectAlternative,
  onEditTacticalInstruction,
  onDispatchClearancePlan,
  onApproveRecoveryPlan,
}: ActivePlanViewProps) {
  const activePlan = snapshot.stagedRecoveryPlan
    ? { label: "Recovery Plan", plan: snapshot.stagedRecoveryPlan }
    : snapshot.stagedClearancePlan
      ? { label: "Clearance Plan", plan: snapshot.stagedClearancePlan }
      : undefined;

  if (!activePlan) {
    return (
      <section className="active-plan-view" aria-labelledby="active-plan-heading">
        <p>Active Plan</p>
        <h2 id="active-plan-heading">No active plan</h2>
        <p>Staged plans will appear here for accountable review.</p>
      </section>
    );
  }

  const isClearancePlan = snapshot.stagedClearancePlan !== undefined;
  const selectedCount =
    activePlan.plan.members.filter(({ selected }) => selected).length +
    activePlan.plan.tacticalMembers.filter(({ selected }) => selected).length;
  const callsignFor = (aircraftId: string) =>
    snapshot.aircraft.find(({ id }) => id === aircraftId)?.callsign ?? aircraftId;

  return (
    <section className="active-plan-view" aria-labelledby="active-plan-heading">
      <p>Active Plan</p>
      <h2 id="active-plan-heading">{activePlan.label}</h2>
      <p className="active-plan-summary">
        <strong>{activePlan.plan.reference}</strong> · {CLASSIFICATION_LABELS[activePlan.plan.classification]}
      </p>

      <ul className="active-plan-members">
        {activePlan.plan.members
          .filter(({ selected }) => isClearancePlan || selected)
          .map((member) => {
            const callsign = callsignFor(member.aircraftId);
            const summary = clearanceSummary(member.clearance);
            return (
              <li key={member.id}>
                {isClearancePlan ? (
                  <label className="active-plan-member-selection">
                    <input
                      type="checkbox"
                      checked={member.selected}
                      aria-label={`Include ${callsign} ${summary}`}
                      onChange={(event) =>
                        onSetMemberSelected?.(member.id, event.currentTarget.checked)
                      }
                    />
                    <span>{callsign} · {summary}</span>
                  </label>
                ) : (
                  <span>{callsign} · {summary}</span>
                )}
                {isClearancePlan && member.alternatives.length > 0 ? (
                  <div className="active-plan-alternatives" aria-label={`Alternatives for ${callsign}`}>
                    {member.alternatives.map((alternative) => (
                      <button
                        type="button"
                        key={alternative.id}
                        onClick={() => onSelectAlternative?.(member.id, alternative.id)}
                      >
                        Use {clearanceSummary(alternative.clearance)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}

        {activePlan.plan.tacticalMembers
          .filter(({ selected }) => selected)
          .map((member) => {
            const callsign = callsignFor(member.aircraftId);
            return (
              <li key={member.id}>
                <form
                  className="active-plan-tactical-edit"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    onEditTacticalInstruction?.(member.id, {
                      headingDegrees: numberFromForm(form, "headingDegrees"),
                      altitudeFeet: numberFromForm(form, "altitudeFeet"),
                      speedKnots: numberFromForm(form, "speedKnots"),
                    });
                  }}
                >
                  <strong>{callsign} · Tactical Instruction</strong>
                  <label>
                    <span>Heading</span>
                    <input
                      aria-label={`Heading for ${callsign}`}
                      name="headingDegrees"
                      type="number"
                      min="1"
                      max="360"
                      defaultValue={member.instruction.headingDegrees}
                    />
                  </label>
                  <label>
                    <span>Altitude (ft)</span>
                    <input
                      aria-label={`Altitude for ${callsign}`}
                      name="altitudeFeet"
                      type="number"
                      min="1"
                      step="100"
                      defaultValue={member.instruction.altitudeFeet}
                    />
                  </label>
                  <label>
                    <span>Speed (kt)</span>
                    <input
                      aria-label={`Speed for ${callsign}`}
                      name="speedKnots"
                      type="number"
                      min="1"
                      defaultValue={member.instruction.speedKnots}
                    />
                  </label>
                  <button type="submit">Apply tactical edit</button>
                </form>
              </li>
            );
          })}
      </ul>

      <p>Expires at {formatSimulationTime(activePlan.plan.expiresAtSimulationTimeMs)}</p>
      {snapshot.stagedRecoveryPlan ? (
        <button type="button" onClick={onApproveRecoveryPlan}>
          Approve & dispatch Recovery Plan
        </button>
      ) : (
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onDispatchClearancePlan}
        >
          Dispatch {selectedCount} selected {selectedCount === 1 ? "item" : "items"}
        </button>
      )}
    </section>
  );
}
