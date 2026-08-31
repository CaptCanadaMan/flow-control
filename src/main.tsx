import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { App, type ConnectionHealth } from "./App";
import {
  createFlowControlApplication,
  type TowerSnapshot,
} from "./application";
import type { ShiftPace } from "./components/StartupPanel";
import type { OperationalReceiptRecord } from "./components/AuditPanel";
import { armShift } from "./shift-lifecycle";
import { connectWebMcp, type ModelContext } from "./webmcp";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Flow Control root element is missing.");
}

const modelContext = (
  document as Document & { modelContext?: ModelContext }
).modelContext;

type FlowControlApplication = ReturnType<typeof createFlowControlApplication>;

function createShiftIdentifier() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `shift-${randomId}` : `shift-${Date.now().toString(36)}`;
}

function FlowControlPage() {
  const applicationReference = useRef<FlowControlApplication | undefined>(undefined);
  const [application, setApplication] = useState<FlowControlApplication | undefined>();
  const [snapshot, setSnapshot] = useState<TowerSnapshot | undefined>();
  const [screenName, setScreenName] = useState<string | undefined>();
  const [pace, setPace] = useState<ShiftPace>(1.5);
  const [initialOperatingPosture, setInitialOperatingPosture] =
    useState<"observe" | "assist" | "take-the-sector">("take-the-sector");
  const [startupCopyStatus, setStartupCopyStatus] = useState<string | undefined>();
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | undefined>(
    () => snapshot?.aircraft[0]?.id,
  );
  const [connectionHealth, setConnectionHealth] =
    useState<ConnectionHealth>("healthy");
  const [operationalReceipts, setOperationalReceipts] = useState<
    OperationalReceiptRecord[]
  >([]);

  const armConfiguredShift = useCallback(() => {
    if (!modelContext || applicationReference.current) {
      return;
    }

    const armedApplication = armShift(
      {
        screenName,
        pace,
        operatingPosture: initialOperatingPosture,
      },
      { scenarioSeed: createShiftIdentifier() },
    );
    applicationReference.current = armedApplication;
    setApplication(armedApplication);
    setSnapshot(
      armedApplication.query({ type: "tower-snapshot" }) as TowerSnapshot,
    );
    setOperationalReceipts(
      armedApplication.query({
        type: "operational-receipts",
      }) as OperationalReceiptRecord[],
    );
    void connectWebMcp({ application: armedApplication, modelContext }).catch(
      (error: unknown) => {
        console.error("Flow Control could not register its WebMCP tools.", error);
      },
    );
  }, [initialOperatingPosture, pace, screenName]);

  const copyKickoffPrompt = useCallback(async (prompt: string) => {
    if (!navigator.clipboard?.writeText) {
      setStartupCopyStatus("Copy is unavailable here. Select the prompt and copy it manually.");
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      setStartupCopyStatus("Kickoff prompt copied.");
    } catch {
      setStartupCopyStatus("Copy was not permitted. Select the prompt and copy it manually.");
    }
  }, []);

  useEffect(() => {
    if (!application) {
      return;
    }

    const unsubscribe = application.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setOperationalReceipts(
        application.query({
          type: "operational-receipts",
        }) as OperationalReceiptRecord[],
      );
    });
    const refreshConnectionHealth = () => {
      const health = application.query({ type: "connection-health" }) as {
        state: ConnectionHealth;
      };
      setConnectionHealth(health.state);
    };
    const interval = globalThis.setInterval(refreshConnectionHealth, 500);

    return () => {
      unsubscribe();
      globalThis.clearInterval(interval);
    };
  }, [application]);

  return (
    <App
      webMcpAvailable={Boolean(modelContext)}
      screenName={screenName}
      pace={pace}
      initialOperatingPosture={initialOperatingPosture}
      startupCopyStatus={startupCopyStatus}
      onScreenNameChange={setScreenName}
      onPaceChange={setPace}
      onInitialOperatingPostureChange={setInitialOperatingPosture}
      onArmConfiguredShift={armConfiguredShift}
      onCopyKickoffPrompt={copyKickoffPrompt}
      snapshot={snapshot}
      selectedAircraftId={selectedAircraftId}
      onSelectAircraft={setSelectedAircraftId}
      onApproveRecoveryPlan={() => {
        if (!application || !snapshot?.stagedRecoveryPlan) {
          return;
        }
        application.command({
          type: "approve-recovery-plan",
          actor: "supervising-controller",
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      onSetClearancePlanMemberSelected={(memberId, selected) => {
        if (!application || !snapshot?.stagedClearancePlan) {
          return;
        }
        application.command({
          type: "set-clearance-plan-member-selection",
          actor: "supervising-controller",
          memberId,
          selected,
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      onDispatchSelectedClearancePlan={() => {
        if (!application || !snapshot?.stagedClearancePlan) {
          return;
        }
        application.command({
          type: "dispatch-selected-clearance-plan",
          actor: "supervising-controller",
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      onSelectClearancePlanAlternative={(memberId, alternativeId) => {
        if (!application || !snapshot?.stagedClearancePlan) {
          return;
        }
        application.command({
          type: "select-clearance-plan-alternative",
          actor: "supervising-controller",
          memberId,
          alternativeId,
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      onEditClearancePlanTacticalInstruction={(memberId, changes) => {
        if (!application || !snapshot?.stagedClearancePlan) {
          return;
        }
        application.command({
          type: "edit-clearance-plan-tactical-instruction",
          actor: "supervising-controller",
          memberId,
          changes,
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      onIssueManualRunwayClearance={({ aircraftId, clearance }) => {
        if (!application || !snapshot) {
          return;
        }
        application.command({
          type: "issue-runway-clearance",
          actor: "supervising-controller",
          aircraftId,
          clearance,
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      onIssueManualTacticalInstruction={({ aircraftId, instruction }) => {
        if (!application || !snapshot) {
          return;
        }
        application.command({
          type: "issue-tactical-instruction",
          actor: "supervising-controller",
          aircraftId,
          instruction,
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      operationalReceipts={operationalReceipts}
      onExportAudit={() => {
        if (!snapshot) {
          return;
        }
        const contents = JSON.stringify(
          {
            scenarioSeed: snapshot.scenarioSeed,
            controllerScreenName: snapshot.controllerScreenName,
            exportedAtStateVersion: snapshot.stateVersion,
            receipts: operationalReceipts,
          },
          null,
          2,
        );
        const downloadUrl = URL.createObjectURL(
          new Blob([contents], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `flow-control-${snapshot.scenarioSeed}-audit.json`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
      }}
      shiftStatus={snapshot?.shiftStatus}
      stateVersion={snapshot?.stateVersion}
      operatingPosture={snapshot?.operatingPosture}
      pendingOperatingPosture={snapshot?.pendingOperatingPosture}
      capabilitySynchronization={snapshot?.capabilitySynchronization}
      connectionHealth={connectionHealth}
      stagedClearancePlanReference={snapshot?.stagedClearancePlanReference}
      onReduceToObserve={() => {
        if (!application || !snapshot) {
          return;
        }
        application.command({
          type: "reduce-operating-posture",
          actor: "supervising-controller",
          operatingPosture: "observe",
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      onRequestTakeTheSector={() => {
        if (!application || !snapshot) {
          return;
        }
        application.command({
          type: "request-operating-posture-increase",
          actor: "supervising-controller",
          operatingPosture: "take-the-sector",
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
      onConfirmTakeTheSector={() => {
        if (!application || !snapshot) {
          return;
        }
        application.command({
          type: "confirm-operating-posture-increase",
          actor: "supervising-controller",
          expectedStateVersion: snapshot.stateVersion,
        });
      }}
    />
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <FlowControlPage />
  </StrictMode>,
);
