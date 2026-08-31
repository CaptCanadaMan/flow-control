import { describe, expect, it, vi } from "vitest";

import { createFlowControlApplication } from "./application";
import { armShift } from "./shift-lifecycle";

describe("armShift", () => {
  it("creates one application from the selected session configuration", () => {
    const createApplication = vi.fn(createFlowControlApplication);

    const application = armShift(
      {
        screenName: "Maya",
        pace: 1.5,
        operatingPosture: "assist",
      },
      { scenarioSeed: "armed-shift", createApplication },
    );

    expect(createApplication).toHaveBeenCalledWith({
      scenarioSeed: "armed-shift",
      controllerScreenName: "Maya",
      operatingPosture: "assist",
      simulation: { fixedTimeStepMs: 100, paceMultiplier: 1.5 },
    });
    expect(application.query({ type: "tower-snapshot" })).toMatchObject({
      scenarioSeed: "armed-shift",
      controllerScreenName: "Maya",
      operatingPosture: "assist",
      shiftStatus: "armed",
    });
  });
});
