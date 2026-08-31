import type { OperatingPosture, TowerSnapshot } from "./application";
import { ActivePlanView } from "./components/ActivePlanView";
import { AuditPanel, type OperationalReceiptRecord } from "./components/AuditPanel";
import {
  ManualControls,
  type ManualRunwayClearance,
  type ManualTacticalInstruction,
} from "./components/ManualControls";
import { Radar } from "./components/Radar";
import { SelectedAircraftView } from "./components/SelectedAircraftView";
import {
  AuthorityStrip,
  StartupPanel,
  type ShiftPace,
} from "./components/StartupPanel";
import { ShiftScorecard } from "./components/ShiftScorecard";
import { TransmissionHistory } from "./components/TransmissionHistory";

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
  onReduceToObserve,
  onRequestTakeTheSector,
  onConfirmTakeTheSector,
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

  if (!snapshot) {
    return (
      <main>
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
          <AuthorityStrip
            operatingPosture={situationPosture}
            connectionHealth={connectionHealth}
            stateVersion={stateVersion}
            pendingOperatingPosture={pendingOperatingPosture}
          />
          <Radar
            snapshot={snapshot}
            selectedAircraftId={selectedAircraftId}
            onSelectAircraft={onSelectAircraft}
          />

          <details className="operational-panel-shell" open>
            <summary>Operational panel</summary>
            <aside className="operational-panel" aria-label="Operational panel">
            <section aria-labelledby="situation-heading">
              <p>Situation</p>
              <h2 id="situation-heading">{snapshot.aircraft.length} aircraft tracked</h2>
              <p>
                Wind {snapshot.weather.windDirectionDegrees}° at {snapshot.weather.windSpeedKnots} kt · Visibility {snapshot.weather.visibilityStatuteMiles} sm · Ceiling {snapshot.weather.ceilingFeet.toLocaleString()} ft
              </p>
              <p><strong>Operating Posture: {POSTURE_LABELS[situationPosture]}</strong></p>
              {snapshot.runwayResources.runwayOccupancy.length === 0 ? (
                <p>Runways clear.</p>
              ) : (
                <ul className="runway-occupancy" aria-label="Runway occupancy">
                  {snapshot.runwayResources.runwayOccupancy.map((occupancy) => (
                    <li key={`${occupancy.runwayId}-${occupancy.aircraftId}`}>
                      Runway {occupancy.runwayId} occupied by {occupancy.callsign} ({occupancy.operation})
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <SelectedAircraftView
              snapshot={snapshot}
              selectedAircraftId={selectedAircraftId}
            />
            <ActivePlanView
              snapshot={snapshot}
              onSetMemberSelected={onSetClearancePlanMemberSelected}
              onSelectAlternative={onSelectClearancePlanAlternative}
              onEditTacticalInstruction={onEditClearancePlanTacticalInstruction}
              onDispatchClearancePlan={onDispatchSelectedClearancePlan}
              onApproveRecoveryPlan={onApproveRecoveryPlan}
            />
            {shiftStatus === "active" ? (
              <ManualControls
                selectedAircraft={selectedAircraft}
                aircraft={snapshot.aircraft}
                onIssueRunwayClearance={onIssueManualRunwayClearance}
                onIssueTacticalInstruction={onIssueManualTacticalInstruction}
              />
            ) : null}
            <TransmissionHistory snapshot={snapshot} />
            <AuditPanel receipts={operationalReceipts} onExport={onExportAudit} />
              <ShiftScorecard snapshot={snapshot} receipts={operationalReceipts} />
            </aside>
          </details>
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
