// Startup capability set: the one thing a Tower Agent can discover before a
// Supervising Controller arms a Shift. It exists so an agent that attaches
// cold can tell "this page is waiting on a human" apart from "this page has no
// WebMCP support", and learn what the human must do next.
//
// It lives under its own lifecycle and is revoked the moment the Shift is
// armed, so the armed capability set (connectWebMcp) is never mixed with it.

import type { OperatingPosture } from "./application";
import type { ModelContext } from "./webmcp";
import { strictObjectSchema, type WebMcpResult } from "./webmcp-contract";

export type StartupConfiguration = {
  screenName?: string;
  pace: number;
  operatingPosture: OperatingPosture;
};

export type StartupDescription = {
  application: string;
  lifecycle: "awaiting-arming";
  webMcp: {
    dialect: string;
    capabilitiesNow: string[];
    capabilitiesAfterArming: string[];
  };
  pendingConfiguration: StartupConfiguration;
  humanNextStep: string;
  agentNextStep: string;
};

export const DESCRIBE_TOWER_CONTRACT = {
  description:
    "Describe this tower workspace before a Shift is armed: what the application is, the pending Shift configuration, what the Supervising Controller must do next, and which capabilities appear once they do.",
  inputSchema: strictObjectSchema(),
  annotations: { readOnlyHint: true },
} as const;

export function describeTower(
  configuration: StartupConfiguration,
): WebMcpResult<StartupDescription> {
  return {
    status: "success",
    stateVersion: 0,
    simulationTimeMs: 0,
    affectedAircraft: [],
    summary:
      "Flow Control is awaiting arming. A Supervising Controller must arm the configured Shift before Tower Agent capabilities are registered.",
    nextAction:
      "Ask the Supervising Controller to press \"Arm configured Shift\", then rediscover tools and call begin_tower_shift with expectedStateVersion 0.",
    data: {
      application:
        "Flow Control: a human-supervised tower control workspace. A Supervising Controller watches the radar and approves plans; a Tower Agent works the traffic through WebMCP tools whose set changes with the Shift's authority posture.",
      lifecycle: "awaiting-arming",
      webMcp: {
        dialect: "document.modelContext.registerTool(tool, { signal }); tools are revoked by aborting their lifecycle signal, so rediscover after every authority change.",
        capabilitiesNow: ["describe_tower"],
        capabilitiesAfterArming: ["begin_tower_shift"],
      },
      pendingConfiguration: configuration,
      humanNextStep:
        "Press \"Arm configured Shift\" in the browser. Optionally set a screen name, pace and starting authority posture first.",
      agentNextStep:
        "Wait for the human, rediscover tools, then call begin_tower_shift with expectedStateVersion 0. Arming revokes describe_tower.",
    },
  };
}

/**
 * Register describe_tower under its own lifecycle. Call `revoke()` at arm time,
 * before connecting the armed capability set.
 */
export async function connectStartupWebMcp({
  modelContext,
  configuration,
}: {
  modelContext: ModelContext;
  configuration: () => StartupConfiguration;
}) {
  const lifecycle = new AbortController();
  await modelContext.registerTool(
    {
      name: "describe_tower",
      description: DESCRIBE_TOWER_CONTRACT.description,
      inputSchema: DESCRIBE_TOWER_CONTRACT.inputSchema,
      annotations: { ...DESCRIBE_TOWER_CONTRACT.annotations },
      execute: () => describeTower(configuration()),
    },
    { signal: lifecycle.signal },
  );
  return {
    revoke() {
      lifecycle.abort();
    },
  };
}
