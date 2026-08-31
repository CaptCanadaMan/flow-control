import {
  createFlowControlApplication,
  type OperatingPosture,
} from "./application";
import type { ShiftPace } from "./components/StartupPanel";

export type ShiftConfiguration = {
  screenName?: string;
  pace: ShiftPace;
  operatingPosture: OperatingPosture;
};

type FlowControlApplicationFactory = typeof createFlowControlApplication;

export function armShift(
  configuration: ShiftConfiguration,
  {
    scenarioSeed,
    createApplication = createFlowControlApplication,
  }: {
    scenarioSeed: string;
    createApplication?: FlowControlApplicationFactory;
  },
) {
  return createApplication({
    scenarioSeed,
    controllerScreenName: configuration.screenName?.trim() || undefined,
    operatingPosture: configuration.operatingPosture,
    simulation: {
      fixedTimeStepMs: 100,
      paceMultiplier: configuration.pace,
    },
  });
}
