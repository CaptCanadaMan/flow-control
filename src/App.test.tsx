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
});
