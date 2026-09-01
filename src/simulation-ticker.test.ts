import { describe, expect, it, vi } from "vitest";

import { createSimulationTicker } from "./simulation-ticker";

function createManualClock() {
  let currentTime = 0;
  const intervals = new Map<number, () => void>();
  let nextHandle = 1;

  return {
    now: () => currentTime,
    setInterval: (callback: () => void) => {
      const handle = nextHandle;
      nextHandle += 1;
      intervals.set(handle, callback);
      return handle;
    },
    clearInterval: (handle: number) => {
      intervals.delete(handle);
    },
    advance(elapsedMs: number) {
      currentTime += elapsedMs;
      for (const callback of [...intervals.values()]) {
        callback();
      }
    },
    activeIntervals: () => intervals.size,
  };
}

describe("createSimulationTicker", () => {
  it("dispatches one whole simulation step per elapsed wall-clock step", () => {
    const clock = createManualClock();
    const dispatchSteps = vi.fn();
    const ticker = createSimulationTicker({
      dispatchSteps,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
    });

    ticker.start();
    clock.advance(100);
    clock.advance(100);

    expect(dispatchSteps).toHaveBeenCalledTimes(2);
    expect(dispatchSteps).toHaveBeenNthCalledWith(1, 1);
    expect(dispatchSteps).toHaveBeenNthCalledWith(2, 1);
  });

  it("accumulates partial steps instead of dropping or duplicating time", () => {
    const clock = createManualClock();
    const dispatchSteps = vi.fn();
    const ticker = createSimulationTicker({
      dispatchSteps,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
    });

    ticker.start();
    clock.advance(60);
    expect(dispatchSteps).not.toHaveBeenCalled();
    clock.advance(60);
    expect(dispatchSteps).toHaveBeenCalledWith(1);
    clock.advance(80);
    expect(dispatchSteps).toHaveBeenLastCalledWith(1);
    expect(dispatchSteps).toHaveBeenCalledTimes(2);
  });

  it("catches up after throttling in bounded batches", () => {
    const clock = createManualClock();
    const dispatchSteps = vi.fn();
    const ticker = createSimulationTicker({
      dispatchSteps,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
    });

    ticker.start();
    clock.advance(20_000);

    expect(dispatchSteps).toHaveBeenCalledTimes(1);
    expect(dispatchSteps).toHaveBeenCalledWith(50);
  });

  it("stops dispatching and clears its interval when stopped", () => {
    const clock = createManualClock();
    const dispatchSteps = vi.fn();
    const ticker = createSimulationTicker({
      dispatchSteps,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
    });

    ticker.start();
    clock.advance(100);
    ticker.stop();
    clock.advance(500);

    expect(dispatchSteps).toHaveBeenCalledTimes(1);
    expect(clock.activeIntervals()).toBe(0);
  });

  it("ignores repeated start calls while running", () => {
    const clock = createManualClock();
    const dispatchSteps = vi.fn();
    const ticker = createSimulationTicker({
      dispatchSteps,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
    });

    ticker.start();
    ticker.start();
    clock.advance(100);

    expect(dispatchSteps).toHaveBeenCalledTimes(1);
    expect(clock.activeIntervals()).toBe(1);
  });
});
