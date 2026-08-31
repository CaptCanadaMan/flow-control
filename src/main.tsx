import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { App, type ConnectionHealth } from "./App";
import {
  createFlowControlApplication,
  type TowerSnapshot,
} from "./application";
import { connectWebMcp, type ModelContext } from "./webmcp";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Flow Control root element is missing.");
}

const modelContext = (
  document as Document & { modelContext?: ModelContext }
).modelContext;

const application = modelContext
  ? createFlowControlApplication({
    scenarioSeed: "phase-0",
    operatingPosture: "take-the-sector",
    })
  : undefined;

if (modelContext && application) {
  void connectWebMcp({ application, modelContext }).catch((error: unknown) => {
    console.error("Flow Control could not register its WebMCP tools.", error);
  });
}

function FlowControlPage() {
  const [snapshot, setSnapshot] = useState<TowerSnapshot | undefined>(() =>
    application
      ? (application.query({ type: "tower-snapshot" }) as TowerSnapshot)
      : undefined,
  );
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | undefined>(
    () => snapshot?.aircraft[0]?.id,
  );
  const [connectionHealth, setConnectionHealth] =
    useState<ConnectionHealth>("healthy");

  useEffect(() => {
    if (!application) {
      return;
    }

    const unsubscribe = application.subscribe(setSnapshot);
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
  }, []);

  return (
    <App
      webMcpAvailable={Boolean(modelContext)}
      snapshot={snapshot}
      selectedAircraftId={selectedAircraftId}
      onSelectAircraft={setSelectedAircraftId}
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
