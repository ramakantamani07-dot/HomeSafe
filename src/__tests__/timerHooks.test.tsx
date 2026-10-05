/**
 * Timer hook tests.
 *
 * These two hooks exist to make leaked timers impossible, so the tests that
 * matter are the cleanup ones: a timer that survives unmount keeps the JS
 * thread waking up for a screen nobody is looking at, and on a safety app
 * that is battery drain the user never asked for.
 *
 * Uses react-test-renderer (already present via jest-expo) rather than adding
 * a testing-library dependency — a hook under test only needs a host component
 * to live in.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useInterval } from '../hooks/useInterval';
import { useTimeout } from '../hooks/useTimeout';

// ─── Harnesses ───────────────────────────────────────────────────────────────

function IntervalHarness({
  onTick,
  delayMs,
  pauseInBackground,
}: {
  onTick(): void;
  delayMs: number | null;
  pauseInBackground?: boolean;
}) {
  useInterval(onTick, delayMs, { pauseInBackground });
  return null;
}

function TimeoutHarness({ onFire, delayMs }: { onFire(): void; delayMs: number | null }) {
  useTimeout(onFire, delayMs);
  return null;
}

/**
 * `TestRenderer.create` and `.update` schedule React work, so under React 19
 * they must themselves run inside `act()` or effects never flush — which would
 * make every test here pass vacuously by never starting a timer at all.
 */
function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  return renderer;
}

function update(renderer: TestRenderer.ReactTestRenderer, element: React.ReactElement) {
  act(() => { renderer.update(element); });
}

function unmount(renderer: TestRenderer.ReactTestRenderer) {
  act(() => { renderer.unmount(); });
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// ─── useInterval ─────────────────────────────────────────────────────────────

describe('useInterval', () => {
  it('fires repeatedly at the given delay', () => {
    const tick = jest.fn();
    // pauseInBackground off: AppState is not driveable under fake timers here,
    // and the pause behaviour has its own test below.
    render(<IntervalHarness onTick={tick} delayMs={1000} pauseInBackground={false} />);

    act(() => { jest.advanceTimersByTime(3000); });
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('stops when the component unmounts', () => {
    const tick = jest.fn();
    const renderer = render(<IntervalHarness onTick={tick} delayMs={1000} pauseInBackground={false} />);

    act(() => { jest.advanceTimersByTime(2000); });
    expect(tick).toHaveBeenCalledTimes(2);

    unmount(renderer);
    act(() => { jest.advanceTimersByTime(5000); });

    // The whole point of the hook — no further calls after unmount.
    expect(tick).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('pauses when delayMs is null, and resumes when it returns', () => {
    const tick = jest.fn();
    const renderer = render(<IntervalHarness onTick={tick} delayMs={null} pauseInBackground={false} />);

    act(() => { jest.advanceTimersByTime(5000); });
    expect(tick).not.toHaveBeenCalled();

    update(renderer, <IntervalHarness onTick={tick} delayMs={1000} pauseInBackground={false} />);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('swaps the callback without restarting the timer', () => {
    const first = jest.fn();
    const second = jest.fn();
    const renderer = render(<IntervalHarness onTick={first} delayMs={1000} pauseInBackground={false} />);

    act(() => { jest.advanceTimersByTime(1500); }); // 1 tick, 500ms into the next

    update(renderer, <IntervalHarness onTick={second} delayMs={1000} pauseInBackground={false} />);
    act(() => { jest.advanceTimersByTime(500); }); // completes the ORIGINAL period

    expect(first).toHaveBeenCalledTimes(1);
    // Fires at 2000ms, not 2500ms — proving the interval was never restarted.
    // A naive implementation with the callback in the dep array would reset
    // here and the tick would be late.
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('leaves no timer behind when the delay changes', () => {
    const tick = jest.fn();
    const renderer = render(<IntervalHarness onTick={tick} delayMs={1000} pauseInBackground={false} />);
    update(renderer, <IntervalHarness onTick={tick} delayMs={500} pauseInBackground={false} />);

    // Exactly one live interval — the old one was cleared, not orphaned.
    expect(jest.getTimerCount()).toBe(1);

    act(() => { jest.advanceTimersByTime(1000); });
    expect(tick).toHaveBeenCalledTimes(2); // 500ms cadence, not 1000ms

    unmount(renderer);
    expect(jest.getTimerCount()).toBe(0);
  });
});

// ─── useTimeout ──────────────────────────────────────────────────────────────

describe('useTimeout', () => {
  it('fires once after the delay', () => {
    const fire = jest.fn();
    render(<TimeoutHarness onFire={fire} delayMs={1000} />);

    act(() => { jest.advanceTimersByTime(5000); });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('does not fire after unmount', () => {
    const fire = jest.fn();
    const renderer = render(<TimeoutHarness onFire={fire} delayMs={1000} />);

    unmount(renderer);
    act(() => { jest.advanceTimersByTime(5000); });

    expect(fire).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('is cancelled by a null delay', () => {
    const fire = jest.fn();
    const renderer = render(<TimeoutHarness onFire={fire} delayMs={1000} />);

    update(renderer, <TimeoutHarness onFire={fire} delayMs={null} />);
    act(() => { jest.advanceTimersByTime(5000); });

    expect(fire).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('restarts when the delay changes', () => {
    const fire = jest.fn();
    const renderer = render(<TimeoutHarness onFire={fire} delayMs={1000} />);

    act(() => { jest.advanceTimersByTime(900); }); // 100ms short of firing
    update(renderer, <TimeoutHarness onFire={fire} delayMs={2000} />);

    // The original timer was cleared, so the deadline is now 2000ms from the
    // change — not the 100ms that was left on the old one.
    act(() => { jest.advanceTimersByTime(1500); });
    expect(fire).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(600); });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('uses the latest callback without restarting', () => {
    const first = jest.fn();
    const second = jest.fn();
    const renderer = render(<TimeoutHarness onFire={first} delayMs={1000} />);

    act(() => { jest.advanceTimersByTime(500); });
    update(renderer, <TimeoutHarness onFire={second} delayMs={1000} />);
    act(() => { jest.advanceTimersByTime(500); });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
