import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuthorityStrip, StartupPanel } from "./StartupPanel";

describe("StartupPanel", () => {
  it("renders the supplied preflight values and makes Take the Sector the selected posture", () => {
    const page = renderToStaticMarkup(
      <StartupPanel
        screenName="Maya"
        pace={1.5}
        operatingPosture="take-the-sector"
        onScreenNameChange={() => undefined}
        onPaceChange={() => undefined}
        onOperatingPostureChange={() => undefined}
        onCopyKickoffPrompt={() => undefined}
      />,
    );

    expect(page).toContain('value="Maya"');
    expect(page).toContain('<option value="1.5" selected="">1.5×');
    expect(page).toContain('aria-pressed="true"');
    expect(page).toContain("Take the Sector");
  });

  it("adapts the copyable kickoff prompt to Assist authority", () => {
    const page = renderToStaticMarkup(
      <StartupPanel
        screenName="Maya"
        pace={0.75}
        operatingPosture="assist"
        onScreenNameChange={() => undefined}
        onPaceChange={() => undefined}
        onOperatingPostureChange={() => undefined}
        onCopyKickoffPrompt={() => undefined}
      />,
    );

    expect(page).toContain("Supervising Controller Maya");
    expect(page).toContain("Assist");
    expect(page).toContain("Stage clearance and recovery plans for human approval; do not dispatch operational work.");
    expect(page).toContain("0.75× pace");
    expect(page).toContain("Copy kickoff prompt");
  });
});

describe("AuthorityStrip", () => {
  it("names degraded connection health alongside posture and State Version", () => {
    const page = renderToStaticMarkup(
      <AuthorityStrip
        operatingPosture="observe"
        connectionHealth="unavailable"
        stateVersion={7}
      />,
    );

    expect(page).toContain("Operating Posture: Observe");
    expect(page).toContain("Connection: Tower Agent unavailable");
    expect(page).toContain("State Version 7");
    expect(page).toContain("!");
  });
});
