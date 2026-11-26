import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DebouncedSaver } from "./debounced-saver.js";

function createSaver(save = vi.fn(async () => {})) {
  const onError = vi.fn();
  const saver = new DebouncedSaver({ save, delayMs: 1_000, maxDelayMs: 5_000, onError });
  return { saver, save, onError };
}

// Fake timers: the test moves the clock instead of really waiting
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("DebouncedSaver", () => {
  it("saves once after the changes pause", async () => {
    const { saver, save } = createSaver();
    saver.schedule();
    await vi.advanceTimersByTimeAsync(500);
    saver.schedule();
    saver.schedule();
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.hasUnsavedChanges).toBe(false);
  });

  it("still saves regularly during non-stop editing", async () => {
    const { saver, save } = createSaver();
    // A change every 500 ms for 6 s: the 1 s pause never happens
    for (let i = 0; i < 12; i++) {
      saver.schedule();
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(save).toHaveBeenCalledTimes(1); // forced by maxDelayMs (5 s)
  });

  it("flush saves immediately, and does nothing without changes", async () => {
    const { saver, save } = createSaver();
    await saver.flush();
    expect(save).not.toHaveBeenCalled();

    saver.schedule();
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("never runs two saves at the same time", async () => {
    let running = 0;
    let maxRunning = 0;
    const { saver } = createSaver(
      vi.fn(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        running--;
      }),
    );

    saver.schedule();
    const first = saver.flush();
    saver.schedule(); // changes while the first save is still running
    const second = saver.flush();
    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.all([first, second]);

    expect(maxRunning).toBe(1);
  });

  it("keeps the changes and retries when saving fails", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("database down"))
      .mockResolvedValue(undefined);
    const { saver, onError } = createSaver(save);

    saver.schedule();
    await saver.flush();
    expect(onError).toHaveBeenCalledOnce();
    expect(saver.hasUnsavedChanges).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(saver.hasUnsavedChanges).toBe(false);
  });
});
