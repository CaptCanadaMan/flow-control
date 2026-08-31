import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("WebMCP preflight", () => {
  it("blocks the Shift and explains how to reopen an unsupported browser", () => {
    const page = renderToStaticMarkup(<App webMcpAvailable={false} />);

    expect(page).toContain("WebMCP is not available");
    expect(page).toContain("ChatGPT in-app browser");
    expect(page).toContain("Chrome 149+");
    expect(page).not.toContain("Shift armed");
  });

  it("shows an armed Observe Shift without starting operational time", () => {
    const page = renderToStaticMarkup(<App webMcpAvailable />);

    expect(page).toContain("Shift armed");
    expect(page).toContain("Observe");
    expect(page).toContain("Traffic remains paused");
    expect(page).toContain("begin_tower_shift");
  });

  it("shows the active State Version after the Tower Agent connects", () => {
    const page = renderToStaticMarkup(
      <App webMcpAvailable shiftStatus="active" stateVersion={1} />,
    );

    expect(page).toContain("Tower Agent connected");
    expect(page).toContain("State Version 1");
    expect(page).not.toContain("Shift armed");
  });

  it("offers immediate reduction while the Tower Agent has Take the Sector authority", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        shiftStatus="active"
        stateVersion={1}
        operatingPosture="take-the-sector"
        onReduceToObserve={() => undefined}
      />,
    );

    expect(page).toContain("Take the Sector");
    expect(page).toContain("Reduce to Observe");
  });

  it("offers an explicit Take the Sector request while active in Observe", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        shiftStatus="active"
        stateVersion={2}
        operatingPosture="observe"
        onRequestTakeTheSector={() => undefined}
      />,
    );

    expect(page).toContain("Request Take the Sector");
  });

  it("requires human confirmation before synchronizing a Take the Sector grant", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
        shiftStatus="active"
        stateVersion={3}
        operatingPosture="observe"
        pendingOperatingPosture="take-the-sector"
        capabilitySynchronization="awaiting-confirmation"
        onConfirmTakeTheSector={() => undefined}
      />,
    );

    expect(page).toContain("Authority grant pending");
    expect(page).toContain("Confirm Take the Sector");
    expect(page).not.toContain("Request Take the Sector");
  });

  it("shows a delayed-contact warning without declaring the Tower Agent unavailable", () => {
    const page = renderToStaticMarkup(
      <App
        webMcpAvailable
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
