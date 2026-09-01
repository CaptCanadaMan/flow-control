const DEFAULT_STEP_MS = 100;
const MAXIMUM_CATCH_UP_MS = 5_000;

export function createSimulationTicker(options: {
  dispatchSteps: (steps: number) => void;
  now?: () => number;
  stepMs?: number;
  setInterval?: (callback: () => void, intervalMs: number) => number;
  clearInterval?: (handle: number) => void;
}) {
  const {
    dispatchSteps,
    now = () => performance.now(),
    stepMs = DEFAULT_STEP_MS,
    setInterval = (callback, intervalMs) =>
      globalThis.setInterval(callback, intervalMs) as unknown as number,
    clearInterval = (handle) => globalThis.clearInterval(handle),
  } = options;

  let intervalHandle: number | undefined;
  let lastTickAt = 0;
  let accumulatedMs = 0;

  function tick() {
    const currentTime = now();
    accumulatedMs += currentTime - lastTickAt;
    lastTickAt = currentTime;
    // A background-throttled tab catches up honestly, but a bounded amount at
    // a time so one dispatch cannot stall the interface after a long absence.
    accumulatedMs = Math.min(accumulatedMs, MAXIMUM_CATCH_UP_MS);
    const steps = Math.floor(accumulatedMs / stepMs);
    if (steps < 1) {
      return;
    }
    accumulatedMs -= steps * stepMs;
    dispatchSteps(steps);
  }

  return {
    start() {
      if (intervalHandle !== undefined) {
        return;
      }
      lastTickAt = now();
      accumulatedMs = 0;
      intervalHandle = setInterval(tick, stepMs);
    },
    stop() {
      if (intervalHandle === undefined) {
        return;
      }
      clearInterval(intervalHandle);
      intervalHandle = undefined;
      accumulatedMs = 0;
    },
  };
}
