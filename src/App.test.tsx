import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { createFlowControlApplication, type TowerSnapshot } from "./application";

function configuredSnapshot(
  operatingPosture: "observe" | "assist" | "take-the-sector" = "observe",
) {
  const application = createFlowControlApplication({
    scenarioSeed: `app-test-${operatingPosture}`,
    operatingPosture,
  });
  return application.query({ type: "tower-snapshot" }) as TowerSnapshot;
}

// Minimal React element walker: renders function components so the posture
// callbacks wired onto the status strip's buttons can be invoked directly
// without a DOM.
type RenderedElement = { type: unknown; props: Record<string, any> };

function childrenOf(element: RenderedElement): RenderedElement[] {
  const rendered =
    typeof element.type === "function"
      ? (element.type as (props: unknown) => unknown)(element.props)
      : element.props.children;
  const list = Array.isArray(rendered) ? rendered : [rendered];
  return list
    .flat(Infinity)
    .filter(
      (child): child is RenderedElement =>
        Boolean(child) && typeof child === "object" && "props" in child,
    );
}

function findElement(
  element: RenderedElement,
  predicate: (candidate: RenderedElement) => boolean,
): RenderedElement {
  if (predicate(element)) {
    return element;
  }
  for (const child of childrenOf(element)) {
    try {
      return findElement(child, predicate);
    } catch {
      // keep searching siblings
    }
  }
  throw new Error("Element not found.");
}

function collectElements(
  element: RenderedElement,
  predicate: (candidate: RenderedElement) => boolean,
): RenderedElement[] {
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap((child) => collectElements(child, predicate)),
  ];
}

describe("WebMCP preflight", () => {
  it("renders a selected aircraft from the authoritative snapshot in the radar and its contextual panel", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-3-operating-canvas",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={snapshot}
        selectedAircraftId="fc-202"
      />,
    );

    expect(page).toContain('aria-label="Flow Field radar scope"');
    expect(page).toContain("FLOW 202");
    expect(page).toContain("Selected Aircraft");
    expect(page).toContain("3,000 ft");
    expect(page).toContain("180 kt");
    expect(page).toContain('<main class="workspace">');
    expect(page).toContain('aria-label="Operational panel"');
    expect(page).not.toContain("operational-panel-shell");
  });

  it("exposes every aircraft as a keyboard-reachable radar selection target", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-3-selection-targets",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    const page = renderToStaticMarkup(
      <App webMcpAvailable snapshot={snapshot} />,
    );

    expect(page.match(/role="button"/g)).toHaveLength(snapshot.aircraft.length);
    expect(page.match(/tabindex="0"/g)).toHaveLength(snapshot.aircraft.length);
  });

  it("renders live weather, runway occupancy, and authority in the Situation view", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-3-situation",
      operatingPosture: "observe",
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;
    snapshot.weather = {
      preset: "westerly",
      windDirectionDegrees: 270,
      windSpeedKnots: 12,
      visibilityStatuteMiles: 8,
      ceilingFeet: 4_500,
    };
    snapshot.runwayResources = {
      runwayOccupancy: [
        {
          runwayId: "09-27",
          aircraftId: "fc-101",
          callsign: "FLOW 101",
          operation: "departure",
          clearsAtSimulationTimeMs: 30_000,
        },
      ],
      intersectionOccupancy: [],
    };
    snapshot.operatingPosture = "assist";

    const page = renderToStaticMarkup(<App webMcpAvailable snapshot={snapshot} />);

    expect(page).toContain("Wind 270° at 12 kt");
    expect(page).toContain("Visibility 8 sm");
    expect(page).toContain("Ceiling 4,500 ft");
    expect(page).toContain('aria-label="Runway 09-27 occupied by FLOW 101"');
    expect(page).toContain("Operating Posture: Assist");
  });

  it("renders a staged Clearance Plan with its selected operational work and expiry", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-3-active-plan",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "departure-and-arrival",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: {
            kind: "clear-for-takeoff",
            runwayId: "09-27",
            runwayEnd: "09",
          },
        },
      ],
      tacticalInstructions: [
        {
          aircraftId: "fc-202",
          instruction: { headingDegrees: 120, altitudeFeet: 3_000, speedKnots: 170 },
        },
      ],
      expectedStateVersion: 1,
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

    const page = renderToStaticMarkup(<App webMcpAvailable snapshot={snapshot} />);

    expect(page).toContain("Active Plan");
    expect(page).toContain("departure-and-arrival");
    expect(page).toContain("Routine");
    expect(page).toContain("FLOW 101 · cleared for takeoff runway 09");
    expect(page).toContain("FLOW 202 · Tactical Instruction");
    expect(page).toContain("Expires at 00:45");
  });

  it("offers an explicit approval action only for a staged Recovery Plan", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-3-recovery-approval",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-recovery-plan",
      actor: "tower-agent",
      planReference: "go-around-recovery",
      runwayClearances: [
        {
          aircraftId: "fc-202",
          clearance: { kind: "go-around", runwayId: "04-22", runwayEnd: "22" },
        },
        {
          aircraftId: "fc-404",
          clearance: { kind: "hold-short", runwayId: "09-27", runwayEnd: "09" },
        },
      ],
      expectedStateVersion: 1,
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={snapshot}
        onApproveRecoveryPlan={() => undefined}
      />,
    );

    expect(page).toContain("Recovery Plan");
    expect(page).toContain("Approve &amp; dispatch Recovery Plan");
  });

  it("renders Clearance Plan member selection and partial-dispatch controls from current state", () => {
    const application = createFlowControlApplication({
      scenarioSeed: "phase-3-partial-dispatch",
      operatingPosture: "assist",
    });
    application.command({
      type: "begin-shift",
      actor: "tower-agent",
      expectedStateVersion: 0,
    });
    application.command({
      type: "stage-clearance-plan",
      actor: "tower-agent",
      planReference: "two-holds",
      runwayClearances: [
        {
          aircraftId: "fc-101",
          clearance: { kind: "hold-short", runwayId: "09-27", runwayEnd: "09" },
        },
        {
          aircraftId: "fc-404",
          clearance: { kind: "hold-short", runwayId: "09-27", runwayEnd: "09" },
        },
      ],
      expectedStateVersion: 1,
    });
    application.command({
      type: "set-clearance-plan-member-selection",
      actor: "supervising-controller",
      memberId: "two-holds:runway-clearance:2",
      selected: false,
      expectedStateVersion: 2,
    });
    const snapshot = application.query({ type: "tower-snapshot" }) as TowerSnapshot;

    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={snapshot}
        onSetClearancePlanMemberSelected={() => undefined}
        onDispatchSelectedClearancePlan={() => undefined}
      />,
    );

    expect(page).toContain('aria-label="Include FLOW 101 hold short runway 09" checked=""');
    expect(page).toContain('aria-label="Include FLOW 404 hold short runway 09"');
    expect(page).not.toContain('aria-label="Include FLOW 404 hold short runway 09" checked=""');
    expect(page).toContain("Dispatch 1 selected item");
  });

  it("blocks the Shift and explains how to reopen an unsupported browser", () => {
    const page = renderToStaticMarkup(<App webMcpAvailable={false} />);

    expect(page).toContain("WebMCP is not available");
    expect(page).toContain("ChatGPT in-app browser");
    expect(page).toContain("Chrome 149+");
    expect(page).not.toContain("Shift armed");
  });

  it("shows an armed Observe Shift with live traffic and controller commands before the agent connects", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot()}
        selectedAircraftId="fc-202"
      />,
    );

    expect(page).toContain("Shift armed");
    expect(page).toContain("Observe");
    expect(page).toContain("Traffic is live");
    expect(page).not.toContain("Traffic remains paused");
    expect(page).toContain("begin_tower_shift");
    expect(page).toContain('aria-label="Command bar"');
  });

  it("shows the active State Version after the Tower Agent connects", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot()}
        shiftStatus="active"
        stateVersion={1}
      />,
    );

    expect(page).toContain("Tower Agent connected");
    expect(page).toContain("State Version 1");
    expect(page).not.toContain("Shift armed");
  });

  it("offers immediate reduction to Assist or Observe while the Tower Agent has Take the Sector authority", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot("take-the-sector")}
        shiftStatus="active"
        stateVersion={1}
        operatingPosture="take-the-sector"
        onReduceOperatingPosture={() => undefined}
      />,
    );

    expect(page).toContain("Take the Sector");
    expect(page).toContain("Reduce to Assist");
    expect(page).toContain("Reduce to Observe");
    expect(page).not.toContain("Request ");
  });

  it("offers a Take the Sector request or an immediate Observe reduction while active in Assist", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot("assist")}
        shiftStatus="active"
        stateVersion={2}
        operatingPosture="assist"
        onReduceOperatingPosture={() => undefined}
        onRequestOperatingPostureIncrease={() => undefined}
      />,
    );

    expect(page).toContain("Request Take the Sector");
    expect(page).toContain("Reduce to Observe");
    expect(page).not.toContain("Reduce to Assist");
    expect(page).not.toContain("Request Assist");
  });

  it("offers explicit Assist and Take the Sector requests while active in Observe", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot()}
        shiftStatus="active"
        stateVersion={2}
        operatingPosture="observe"
        onRequestOperatingPostureIncrease={() => undefined}
      />,
    );

    expect(page).toContain("Request Assist");
    expect(page).toContain("Request Take the Sector");
    expect(page).not.toContain("Reduce to ");
  });

  it("invokes the posture callbacks with the target posture of the pressed control", () => {
    const reductions: string[] = [];
    const requests: string[] = [];
    const element = (
      <App
        webMcpAvailable
        snapshot={configuredSnapshot("assist")}
        shiftStatus="active"
        stateVersion={2}
        operatingPosture="assist"
        onReduceOperatingPosture={(target) => reductions.push(target)}
        onRequestOperatingPostureIncrease={(target) => requests.push(target)}
      />
    );
    const strip = findElement(
      element,
      (candidate) => candidate.props["aria-label"] === "Authority and connection status",
    );
    const buttons = collectElements(
      strip,
      (candidate) => candidate.type === "button",
    );

    buttons.forEach((button) => button.props.onClick());

    expect(reductions).toEqual(["observe"]);
    expect(requests).toEqual(["take-the-sector"]);
  });

  it("requires human confirmation before synchronizing a Take the Sector grant", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot()}
        shiftStatus="active"
        stateVersion={3}
        operatingPosture="observe"
        pendingOperatingPosture="take-the-sector"
        capabilitySynchronization="awaiting-confirmation"
        onConfirmOperatingPostureIncrease={() => undefined}
      />,
    );

    expect(page).toContain("Authority grant pending");
    expect(page).toContain("Confirm Take the Sector");
    expect(page).not.toContain("Request Take the Sector");
    expect(page).not.toContain("Reduce to ");
  });

  it("requires human confirmation before synchronizing an Assist grant", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot()}
        shiftStatus="active"
        stateVersion={3}
        operatingPosture="observe"
        pendingOperatingPosture="assist"
        capabilitySynchronization="awaiting-confirmation"
        onConfirmOperatingPostureIncrease={() => undefined}
      />,
    );

    expect(page).toContain("Authority grant pending");
    expect(page).toContain("Confirm Assist");
    expect(page).not.toContain("Confirm Take the Sector");
    expect(page).not.toContain("Request ");
  });

  it("hides every posture control while capabilities are synchronizing", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot("assist")}
        shiftStatus="active"
        stateVersion={4}
        operatingPosture="assist"
        pendingOperatingPosture="take-the-sector"
        capabilitySynchronization="pending"
      />,
    );

    expect(page).toContain("Synchronizing capabilities");
    expect(page).toContain("Take the Sector pending capability synchronization");
    expect(page).not.toContain("Confirm ");
    expect(page).not.toContain("Request ");
    expect(page).not.toContain("Reduce to ");
  });

  it("shows a delayed-contact warning without declaring the Tower Agent unavailable", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot()}
        shiftStatus="active"
        stateVersion={1}
        connectionHealth="warning"
      />,
    );

    expect(page).toContain("Tower Agent contact delayed");
    expect(page).not.toContain("Tower Agent unavailable");
  });

  it("shows agent unavailability while preserving Supervising Controller control", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot()}
        shiftStatus="active"
        stateVersion={1}
        connectionHealth="unavailable"
      />,
    );

    expect(page).toContain("Tower Agent unavailable");
    expect(page).toContain("Supervising Controller controls remain available");
    expect(page).not.toContain("Tower Agent contact delayed");
  });

  it("briefly confirms Tower Agent reconnection", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot()}
        shiftStatus="active"
        stateVersion={1}
        connectionHealth="reconnected"
      />,
    );

    expect(page).toContain("Tower Agent reconnected");
    expect(page).not.toContain("Tower Agent unavailable");
    expect(page).not.toContain("Tower Agent contact delayed");
  });

  it("shows a staged Clearance Plan in the shared workspace", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        snapshot={configuredSnapshot("assist")}
        shiftStatus="active"
        stateVersion={2}
        operatingPosture="assist"
        stagedClearancePlanReference="phase-0-check"
      />,
    );

    expect(page).toContain("Clearance Plan staged");
    expect(page).toContain("phase-0-check");
  });
});
