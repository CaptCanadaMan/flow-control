export type OperatingPosture = "observe" | "assist" | "take-the-sector";

type Capability =
  | "begin_tower_shift"
  | "get_tower_snapshot"
  | "wait_for_tower_event"
  | "get_selected_context"
  | "get_active_conflicts"
  | "evaluate_clearance_set"
  | "stage_clearance_plan"
  | "stage_recovery_plan"
  | "issue_runway_clearance"
  | "issue_tactical_instruction";

type OperationalReceipt = {
  actor: "tower-agent" | "supervising-controller" | "capability-registry";
  action:
    | "shift-began"
    | "operating-posture-reduced"
    | "operating-posture-increase-requested"
    | "operating-posture-increase-confirmed"
    | "capability-synchronization-completed"
    | "clearance-plan-staged";
  stateVersionBefore: number;
  stateVersionAfter: number;
};

type ApplicationState = {
  scenarioSeed: string;
  operatingPosture: OperatingPosture;
  pendingOperatingPosture?: OperatingPosture;
  capabilitySynchronization?: "awaiting-confirmation" | "pending";
  stagedClearancePlanReference?: string;
  shiftStatus: "armed" | "active";
  stateVersion: number;
  operationalReceipts: OperationalReceipt[];
};

export type TowerSnapshot = Pick<
  ApplicationState,
  "shiftStatus" | "scenarioSeed" | "operatingPosture" | "stateVersion"
> & {
  pendingOperatingPosture?: OperatingPosture;
  capabilitySynchronization?: "awaiting-confirmation" | "pending";
  stagedClearancePlanReference?: string;
};

type Query =
  | { type: "available-capabilities" }
  | { type: "tower-snapshot" }
  | { type: "operational-receipts" }
  | { type: "capabilities-to-register" }
  | { type: "connection-health" }
  | {
      type: "wait-for-tower-event";
      cursor: number;
      heartbeatAfterMs: number;
      signal?: AbortSignal;
    };

type BeginShiftCommand = {
  type: "begin-shift";
  actor: "tower-agent";
  expectedStateVersion: number;
};

type ReduceOperatingPostureCommand = {
  type: "reduce-operating-posture";
  actor: "supervising-controller";
  operatingPosture: "observe";
  expectedStateVersion: number;
};

type RequestOperatingPostureIncreaseCommand = {
  type: "request-operating-posture-increase";
  actor: "supervising-controller";
  operatingPosture: "take-the-sector";
  expectedStateVersion: number;
};

type ConfirmOperatingPostureIncreaseCommand = {
  type: "confirm-operating-posture-increase";
  actor: "supervising-controller";
  expectedStateVersion: number;
};

type CompleteCapabilitySynchronizationCommand = {
  type: "complete-capability-synchronization";
  actor: "capability-registry";
  expectedStateVersion: number;
};

type RenewAgentLeaseCommand = {
  type: "renew-agent-lease";
  actor: "capability-registry";
};

type SetAgentWaitCommand = {
  type: "set-agent-wait";
  actor: "capability-registry";
  active: boolean;
};

type StageClearancePlanCommand = {
  type: "stage-clearance-plan";
  actor: "tower-agent";
  planReference: string;
  expectedStateVersion: number;
};

type Command =
  | BeginShiftCommand
  | ReduceOperatingPostureCommand
  | RequestOperatingPostureIncreaseCommand
  | ConfirmOperatingPostureIncreaseCommand
  | CompleteCapabilitySynchronizationCommand
  | RenewAgentLeaseCommand
  | SetAgentWaitCommand
  | StageClearancePlanCommand;

const OBSERVE_CAPABILITIES: Capability[] = [
  "get_tower_snapshot",
  "wait_for_tower_event",
  "get_selected_context",
  "get_active_conflicts",
  "evaluate_clearance_set",
];

const POSTURE_LABELS: Record<OperatingPosture, string> = {
  observe: "Observe",
  assist: "Assist",
  "take-the-sector": "Take the Sector",
};

function activeCapabilities(posture: OperatingPosture): Capability[] {
  if (posture === "observe") {
    return [...OBSERVE_CAPABILITIES];
  }

  const capabilities: Capability[] = [
    ...OBSERVE_CAPABILITIES,
    "stage_clearance_plan",
    "stage_recovery_plan",
  ];

  if (posture === "take-the-sector") {
    capabilities.push(
      "issue_runway_clearance",
      "issue_tactical_instruction",
    );
  }

  return capabilities;
}

export function createFlowControlApplication(options: {
  scenarioSeed: string;
  operatingPosture: OperatingPosture;
  wallClockNow?: () => number;
  connectionLease?: {
    warningAfterMs: number;
    unavailableAfterMs: number;
    reconnectedForMs?: number;
  };
}) {
  const {
    wallClockNow = Date.now,
    connectionLease = {
      warningAfterMs: 30_000,
      unavailableAfterMs: 60_000,
    },
    ...initialState
  } = options;
  const state: ApplicationState = {
    ...initialState,
    shiftStatus: "armed",
    stateVersion: 0,
    operationalReceipts: [],
  };
  let lastAgentContactAt: number | undefined;
  let reconnectedUntil: number | undefined;
  let activeAgentWaits = 0;
  const subscribers = new Set<(snapshot: TowerSnapshot) => void>();

  function towerSnapshot(): TowerSnapshot {
    return {
      shiftStatus: state.shiftStatus,
      scenarioSeed: state.scenarioSeed,
      operatingPosture: state.operatingPosture,
      stateVersion: state.stateVersion,
      pendingOperatingPosture: state.pendingOperatingPosture,
      capabilitySynchronization: state.capabilitySynchronization,
      stagedClearancePlanReference: state.stagedClearancePlanReference,
    };
  }

  function connectionHealth() {
    const now = wallClockNow();
    const silenceMs = Math.max(0, now - (lastAgentContactAt ?? now));
    const connectionState =
      activeAgentWaits > 0
        ? "healthy"
        : reconnectedUntil !== undefined && now < reconnectedUntil
        ? "reconnected"
        : silenceMs >= connectionLease.unavailableAfterMs
          ? "unavailable"
          : silenceMs >= connectionLease.warningAfterMs
            ? "warning"
            : "healthy";
    return { state: connectionState, silenceMs };
  }

  return {
    command(command: Command) {
      if (command.type === "renew-agent-lease") {
        const now = wallClockNow();
        const wasUnavailable =
          lastAgentContactAt !== undefined &&
          now - lastAgentContactAt >= connectionLease.unavailableAfterMs;
        lastAgentContactAt = now;
        if (wasUnavailable) {
          reconnectedUntil =
            now + (connectionLease.reconnectedForMs ?? 10_000);
        }
        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: "Tower Agent connection lease renewed.",
          nextAction: "continue" as const,
        };
      }

      if (command.type === "set-agent-wait") {
        activeAgentWaits = command.active
          ? activeAgentWaits + 1
          : Math.max(0, activeAgentWaits - 1);
        if (!command.active) {
          lastAgentContactAt = wallClockNow();
        }
        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: command.active
            ? "Tower Agent wait is active."
            : "Tower Agent wait completed.",
          nextAction: "continue" as const,
        };
      }

      if (command.expectedStateVersion !== state.stateVersion) {
        return {
          status: "stale" as const,
          stateVersion: state.stateVersion,
          summary:
            "Shift start refused because the expected State Version is stale.",
          rationale: `Expected State Version ${command.expectedStateVersion}; current State Version is ${state.stateVersion}.`,
          nextAction: "get_tower_snapshot" as const,
        };
      }

      if (
        command.type === "stage-clearance-plan" &&
        state.operatingPosture === "observe"
      ) {
        return {
          status: "refusal" as const,
          stateVersion: state.stateVersion,
          summary:
            "Clearance Plan staging requires Assist or Take the Sector.",
          rationale: "Observe permits read and evaluation capabilities only.",
          nextAction: "request-authority-increase" as const,
        };
      }

      if (command.type === "stage-clearance-plan") {
        state.stagedClearancePlanReference = command.planReference;
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "clearance-plan-staged",
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: `Clearance Plan ${command.planReference} staged for human review.`,
          nextAction: "await-plan-review" as const,
        };
      }

      if (command.type === "reduce-operating-posture") {
        state.operatingPosture = command.operatingPosture;
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "operating-posture-reduced",
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: "Operating Posture reduced to Observe.",
          nextAction: "wait_for_tower_event" as const,
        };
      }

      if (command.type === "request-operating-posture-increase") {
        state.pendingOperatingPosture = command.operatingPosture;
        state.capabilitySynchronization = "awaiting-confirmation";
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "operating-posture-increase-requested",
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "approval-required" as const,
          stateVersion: state.stateVersion,
          summary: "Take the Sector grant is pending human confirmation.",
          nextAction: "confirm-operating-posture-increase" as const,
        };
      }

      if (command.type === "confirm-operating-posture-increase") {
        state.capabilitySynchronization = "pending";
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "operating-posture-increase-confirmed",
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary:
            "Take the Sector grant confirmed; capability synchronization is pending.",
          nextAction: "synchronize-capabilities" as const,
        };
      }

      if (command.type === "complete-capability-synchronization") {
        state.operatingPosture = state.pendingOperatingPosture ?? "observe";
        delete state.pendingOperatingPosture;
        delete state.capabilitySynchronization;
        const stateVersionBefore = state.stateVersion;
        state.stateVersion += 1;
        state.operationalReceipts.push({
          actor: command.actor,
          action: "capability-synchronization-completed",
          stateVersionBefore,
          stateVersionAfter: state.stateVersion,
        });
        const snapshot = towerSnapshot();
        subscribers.forEach((subscriber) => subscriber(snapshot));

        return {
          status: "success" as const,
          stateVersion: state.stateVersion,
          summary: "Take the Sector capability synchronization completed.",
          nextAction: "wait_for_tower_event" as const,
        };
      }

      if (state.shiftStatus === "active") {
        return {
          status: "refusal" as const,
          stateVersion: state.stateVersion,
          summary: "Shift start refused because the Shift is already active.",
          rationale: "A Shift may be begun only once.",
          nextAction: "get_tower_snapshot" as const,
        };
      }

      const stateVersionBefore = state.stateVersion;
      state.shiftStatus = "active";
      lastAgentContactAt = wallClockNow();
      state.stateVersion += 1;
      state.operationalReceipts.push({
        actor: command.actor,
        action: "shift-began",
        stateVersionBefore,
        stateVersionAfter: state.stateVersion,
      });
      const snapshot = towerSnapshot();
      subscribers.forEach((subscriber) => subscriber(snapshot));

      return {
        status: "success" as const,
        stateVersion: state.stateVersion,
        summary: `Tower Agent connected; Shift ${state.scenarioSeed} is active in ${POSTURE_LABELS[state.operatingPosture]}.`,
        nextAction: "get_tower_snapshot" as const,
      };
    },

    query(query: Query) {
      switch (query.type) {
        case "available-capabilities":
          return state.shiftStatus === "armed"
            ? (["begin_tower_shift"] satisfies Capability[])
            : activeCapabilities(state.operatingPosture);
        case "tower-snapshot":
          return towerSnapshot();
        case "capabilities-to-register":
          return state.capabilitySynchronization === "pending" &&
            state.pendingOperatingPosture
            ? activeCapabilities(state.pendingOperatingPosture)
            : state.shiftStatus === "armed"
              ? (["begin_tower_shift"] satisfies Capability[])
              : activeCapabilities(state.operatingPosture);
        case "operational-receipts":
          return [...state.operationalReceipts];
        case "connection-health": {
          return connectionHealth();
        }
        case "wait-for-tower-event":
          if (state.shiftStatus !== "active") {
            return Promise.resolve({
              eventKind: "monitoring-unavailable",
              priority: "attention",
              cursor: query.cursor,
              stateVersion: state.stateVersion,
              simulationTime: 0,
              summary: "Monitoring is unavailable until the Shift is active.",
              actionRequired: true,
            });
          }
          return new Promise((resolve) => {
            const finish = (result: Record<string, unknown>) => {
              query.signal?.removeEventListener("abort", cancel);
              resolve(result);
            };
            const cancel = () => {
              globalThis.clearTimeout(timer);
              finish({
                eventKind: "wait-cancelled",
                priority: "routine",
                cursor: query.cursor,
                stateVersion: state.stateVersion,
                simulationTime: 0,
                summary: "Tower-event wait was cancelled.",
                actionRequired: false,
              });
            };
            const timer = globalThis.setTimeout(() => {
              finish({
                eventKind: "heartbeat",
                priority: "routine",
                cursor: query.cursor,
                stateVersion: state.stateVersion,
                simulationTime: 0,
                summary: "Tower Agent monitoring is current.",
                actionRequired: false,
              });
            }, query.heartbeatAfterMs);

            if (query.signal?.aborted) {
              cancel();
            } else {
              query.signal?.addEventListener("abort", cancel, { once: true });
            }
          });
      }
    },

    subscribe(subscriber: (snapshot: TowerSnapshot) => void) {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
  };
}

export type FlowControlApplication = ReturnType<
  typeof createFlowControlApplication
>;
