import type { OperatingPosture, TowerSnapshot } from "./application";
import { ActivePlanView } from "./components/ActivePlanView";
import { AuditPanel, type OperationalReceiptRecord } from "./components/AuditPanel";
import {
  CommandBar,
  type ManualRunwayClearance,
  type ManualTacticalInstruction,
} from "./components/CommandBar";
import { Radar } from "./components/Radar";
import {
  AuthorityStrip,
  StartupPanel,
  type ShiftPace,
} from "./components/StartupPanel";
import { ShiftScorecard } from "./components/ShiftScorecard";
import { LiveFeed } from "./components/LiveFeed";

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
  screenName,
  pace = 1.5,
  initialOperatingPosture = "take-the-sector",
  startupCopyStatus,
  onScreenNameChange,
  onPaceChange,
  onInitialOperatingPostureChange,
  onArmConfiguredShift,
  onCopyKickoffPrompt,
  selectedAircraftId,
  onSelectAircraft,
  onClearSelection,
  onApproveRecoveryPlan,
  onSetClearancePlanMemberSelected,
  onDispatchSelectedClearancePlan,
  onSelectClearancePlanAlternative,
  onEditClearancePlanTacticalInstruction,
  onIssueManualRunwayClearance,
  onIssueManualTacticalInstruction,
  operationalReceipts = [],
  onExportAudit,
  shiftStatus = "armed",
  stateVersion = 0,
  operatingPosture = "observe",
  pendingOperatingPosture,
  capabilitySynchronization,
  connectionHealth = "healthy",
  stagedClearancePlanReference,
  onReduceOperatingPosture,
  onRequestOperatingPostureIncrease,
  onConfirmOperatingPostureIncrease,
}: {
  webMcpAvailable: boolean;
  screenName?: string;
  pace?: ShiftPace;
  initialOperatingPosture?: OperatingPosture;
  startupCopyStatus?: string;
  onScreenNameChange?: (screenName: string) => void;
  onPaceChange?: (pace: ShiftPace) => void;
  onInitialOperatingPostureChange?: (posture: OperatingPosture) => void;
  onArmConfiguredShift?: () => void;
  onCopyKickoffPrompt?: (prompt: string) => void;
  snapshot?: Pick<
    TowerSnapshot,
    | "aircraft"
    | "aircraftCapabilityProfiles"
    | "airport"
    | "weather"
    | "runwayResources"
    | "operatingPosture"
    | "simulationTimeMs"
    | "stagedClearancePlan"
    | "stagedRecoveryPlan"
    | "transmissions"
    | "shiftStatus"
  >;
  selectedAircraftId?: string;
  onSelectAircraft?: (aircraftId: string) => void;
  onClearSelection?: () => void;
  onApproveRecoveryPlan?: () => void;
  onSetClearancePlanMemberSelected?: (memberId: string, selected: boolean) => void;
  onDispatchSelectedClearancePlan?: () => void;
  onSelectClearancePlanAlternative?: (memberId: string, alternativeId: string) => void;
  onEditClearancePlanTacticalInstruction?: (
    memberId: string,
    changes: { headingDegrees?: number; altitudeFeet?: number; speedKnots?: number },
  ) => void;
  onIssueManualRunwayClearance?: (request: {
    aircraftId: string;
    clearance: ManualRunwayClearance;
  }) => void;
  onIssueManualTacticalInstruction?: (request: {
    aircraftId: string;
    instruction: ManualTacticalInstruction;
  }) => void;
  operationalReceipts?: readonly OperationalReceiptRecord[];
  onExportAudit?: () => void;
  shiftStatus?: "armed" | "active" | "completed" | "incomplete";
  stateVersion?: number;
  operatingPosture?: OperatingPosture;
  pendingOperatingPosture?: OperatingPosture;
  capabilitySynchronization?: "awaiting-confirmation" | "pending";
  connectionHealth?: ConnectionHealth;
  stagedClearancePlanReference?: string;
  onReduceOperatingPosture?: (operatingPosture: "observe" | "assist") => void;
  onRequestOperatingPostureIncrease?: (
    operatingPosture: "assist" | "take-the-sector",
  ) => void;
  onConfirmOperatingPostureIncrease?: () => void;
}) {
  if (!webMcpAvailable) {
    return (
      <main className="preflight">
        <section>
          <p>Flow Control compatibility check</p>
          <h1>WebMCP is not available</h1>
          <p>
            Reopen Flow Control in the ChatGPT in-app browser, or use Chrome 149+
            with WebMCP testing enabled.
          </p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="preflight">
        <header>
          <p>Flow Control · preflight</p>
          <h1>Supervise autonomy from one shared live workspace.</h1>
          <p>
            Configure this Shift before the Tower Agent connects. The armed
            application will use these choices as its authoritative initial state.
          </p>
        </header>
        <div className="startup-shell">
          <StartupPanel
            screenName={screenName}
            pace={pace}
            operatingPosture={initialOperatingPosture}
            onScreenNameChange={(value) => onScreenNameChange?.(value)}
            onPaceChange={(value) => onPaceChange?.(value)}
            onOperatingPostureChange={(value) =>
              onInitialOperatingPostureChange?.(value)
            }
            onCopyKickoffPrompt={(prompt) => onCopyKickoffPrompt?.(prompt)}
          />
          <div className="startup-actions">
            <button type="button" onClick={onArmConfiguredShift}>
              Arm configured Shift
            </button>
            {startupCopyStatus ? <p role="status">{startupCopyStatus}</p> : null}
          </div>
        </div>
        <footer>
          Illustrative simulation only — not for operational air traffic control.
        </footer>
      </main>
    );
  }

  const situationPosture = snapshot.operatingPosture;
  const selectedAircraft = snapshot.aircraft.find(
    ({ id }) => id === selectedAircraftId,
  );
  const aircraftInPlay = snapshot.aircraft.filter(
    ({ flightPhase }) => flightPhase !== "out-of-play",
  ).length;
  const shiftStatusLabel =
    shiftStatus === "armed"
      ? "Shift armed"
      : shiftStatus === "completed"
        ? "Shift complete"
        : shiftStatus === "incomplete"
          ? "Shift ended incomplete"
          : "Tower Agent connected";
  const authorityNote =
    capabilitySynchronization === "awaiting-confirmation"
      ? "Authority grant pending"
      : capabilitySynchronization === "pending"
        ? "Synchronizing capabilities"
        : undefined;
  // Every Operating Posture change the Supervising Controller can make from the
  // current posture. Reductions apply immediately; any increase in delegated
  // authority is only requested here and takes effect after explicit
  // confirmation and capability synchronization.
  const reduceButton = (target: "observe" | "assist") => (
    <button
      type="button"
      key={`reduce-${target}`}
      onClick={() => onReduceOperatingPosture?.(target)}
    >
      Reduce to {POSTURE_LABELS[target]}
    </button>
  );
  const requestButton = (target: "assist" | "take-the-sector") => (
    <button
      type="button"
      key={`request-${target}`}
      onClick={() => onRequestOperatingPostureIncrease?.(target)}
    >
      Request {POSTURE_LABELS[target]}
    </button>
  );
  const postureAction =
    shiftStatus !== "active" ? null : capabilitySynchronization ===
      "awaiting-confirmation" ? (
      <button type="button" onClick={onConfirmOperatingPostureIncrease}>
        Confirm {POSTURE_LABELS[pendingOperatingPosture ?? "take-the-sector"]}
      </button>
    ) : capabilitySynchronization === "pending" ? null : operatingPosture ===
      "take-the-sector" ? (
      <>
        {reduceButton("assist")}
        {reduceButton("observe")}
      </>
    ) : operatingPosture === "assist" ? (
      <>
        {requestButton("take-the-sector")}
        {reduceButton("observe")}
      </>
    ) : (
      <>
        {requestButton("assist")}
        {requestButton("take-the-sector")}
      </>
    );
  const shiftEnded = shiftStatus === "completed" || shiftStatus === "incomplete";

  return (
    <main className="workspace">
      <AuthorityStrip
        operatingPosture={situationPosture}
        connectionHealth={connectionHealth}
        stateVersion={stateVersion}
        pendingOperatingPosture={pendingOperatingPosture}
        shiftStatusLabel={shiftStatusLabel}
        authorityNote={authorityNote}
        simulationTimeMs={snapshot.simulationTimeMs}
        aircraftInPlay={aircraftInPlay}
        weather={snapshot.weather}
        action={postureAction}
      />

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

      <section className="workspace-canvas" aria-label="Operating canvas">
        <div className="workspace-scope">
          <Radar
            snapshot={snapshot}
            selectedAircraftId={selectedAircraftId}
            onSelectAircraft={onSelectAircraft}
            onClearSelection={onClearSelection}
          />
          {shiftStatus === "active" ? (
            <CommandBar
              selectedAircraft={selectedAircraft}
              aircraft={snapshot.aircraft}
              onIssueRunwayClearance={onIssueManualRunwayClearance}
              onIssueTacticalInstruction={onIssueManualTacticalInstruction}
            />
          ) : null}
        </div>

        <aside className="operational-panel" aria-label="Operational panel">
          {shiftStatus === "armed" ? (
            <section className="panel-zone panel-armed" aria-labelledby="shift-status">
              <h2 id="shift-status">Shift armed</h2>
              <p>
                Traffic remains paused until the Tower Agent connects in{" "}
                <strong>{POSTURE_LABELS[operatingPosture]}</strong>. Ask the
                browser agent to call:
              </p>
              <code>begin_tower_shift({`{"expectedStateVersion":0}`})</code>
            </section>
          ) : null}

          {shiftEnded ? (
            <ShiftScorecard snapshot={snapshot} receipts={operationalReceipts} />
          ) : (
            <>
              <div className="panel-zone panel-plan">
                <ActivePlanView
                  snapshot={snapshot}
                  onSetMemberSelected={onSetClearancePlanMemberSelected}
                  onSelectAlternative={onSelectClearancePlanAlternative}
                  onEditTacticalInstruction={onEditClearancePlanTacticalInstruction}
                  onDispatchClearancePlan={onDispatchSelectedClearancePlan}
                  onApproveRecoveryPlan={onApproveRecoveryPlan}
                />
                {stagedClearancePlanReference &&
                !snapshot.stagedClearancePlan &&
                !snapshot.stagedRecoveryPlan ? (
                  <div className="staged-plan" role="status">
                    <strong>Clearance Plan staged</strong>
                    <code>{stagedClearancePlanReference}</code>
                  </div>
                ) : null}
              </div>
              <div className="panel-zone panel-feed">
                <LiveFeed snapshot={snapshot} receipts={operationalReceipts} />
              </div>
            </>
          )}

          <div className="panel-zone panel-footer">
            <AuditPanel receipts={operationalReceipts} onExport={onExportAudit} />
          </div>
        </aside>
      </section>
    </main>
  );
}
