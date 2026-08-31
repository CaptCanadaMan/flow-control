import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
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

  useEffect(() => application?.subscribe(setSnapshot), []);

  return (
    <App
      webMcpAvailable={Boolean(modelContext)}
      shiftStatus={snapshot?.shiftStatus}
      stateVersion={snapshot?.stateVersion}
      operatingPosture={snapshot?.operatingPosture}
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
    />
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <FlowControlPage />
  </StrictMode>,
);
