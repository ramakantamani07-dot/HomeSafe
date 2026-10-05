/**
 * Safety Check Tests
 *
 * The automatic "are you OK?" behind screen 08. These thresholds decide when
 * a real person gets interrupted and when their guardians get woken up, so
 * the false-positive cases matter as much as the true ones: a prompt that
 * fires on a phone that has merely stopped *reporting* teaches people to
 * dismiss safety prompts without reading them.
 *
 * Pure unit tests against SafetyCheckService.detect — no React, no timers.
 */

import { SafetyCheckService, type PositionSample } from '../services/SafetyCheckService';
import { MockSafetyCheckProvider } from '../implementations/safetyCheck/MockSafetyCheckProvider';
import { DEFAULT_ALERT_RULES, describeSafetyCheckReason } from '../models/AlertRules';
import type { AlertRules } from '../models/AlertRules';
import type { Coordinates } from '../models/Journey';

const NOW = new Date('2026-09-30T15:00:00Z');

const RULES: AlertRules = DEFAULT_ALERT_RULES; // late 10, stopped 10, no-reply 2, battery 10

const SPOT: Coordinates = { latitude: 51.4712, longitude: -0.0685 };

function minutesAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 60_000);
}

/** Samples spanning `spanMinutes`, all within a few metres of each other. */
function stationarySamples(spanMinutes: number, count = 6): PositionSample[] {
  return Array.from({ length: count }, (_, i) => ({
    coordinates: {
      // ~1 m of jitter — a phone sitting still, not a phone that teleported.
      latitude: SPOT.latitude + i * 0.00001,
      longitude: SPOT.longitude,
    },
    at: new Date(NOW.getTime() - spanMinutes * 60_000 + (i * spanMinutes * 60_000) / (count - 1)),
  }));
}

/** Samples spanning `spanMinutes` that travel a few hundred metres. */
function movingSamples(spanMinutes: number, count = 6): PositionSample[] {
  return Array.from({ length: count }, (_, i) => ({
    coordinates: {
      latitude: SPOT.latitude + i * 0.001, // ~111 m per step
      longitude: SPOT.longitude,
    },
    at: new Date(NOW.getTime() - spanMinutes * 60_000 + (i * spanMinutes * 60_000) / (count - 1)),
  }));
}

function service(): SafetyCheckService {
  return new SafetyCheckService(new MockSafetyCheckProvider());
}

function detect(overrides: Partial<Parameters<SafetyCheckService['detect']>[0]> = {}) {
  return service().detect({
    samples: movingSamples(12),
    eta: new Date(NOW.getTime() + 10 * 60_000),
    offRouteMeters: 20,
    rules: RULES,
    now: NOW,
    ...overrides,
  });
}

// ─── Nothing wrong ───────────────────────────────────────────────────────────

describe('detect — normal travel', () => {
  it('raises nothing when moving, on time and on route', () => {
    expect(detect()).toBeNull();
  });

  it('raises nothing when only slightly late', () => {
    // 5 minutes past the ETA, threshold is 10.
    expect(detect({ eta: new Date(NOW.getTime() - 5 * 60_000) })).toBeNull();
  });

  it('raises nothing when only slightly off route', () => {
    expect(detect({ offRouteMeters: 150 })).toBeNull();
  });

  it('raises nothing when the ETA is unknown', () => {
    // An unrouted journey has no ETA — inventing lateness from nothing would
    // interrupt people at random.
    expect(detect({ eta: null, samples: movingSamples(12) })).toBeNull();
  });
});

// ─── Stopped ─────────────────────────────────────────────────────────────────

describe('detect — stopped', () => {
  it('fires once the stationary window is fully covered', () => {
    expect(detect({ samples: stationarySamples(11) })).toBe('stopped');
  });

  it('does not fire before the threshold is reached', () => {
    // Stationary, but only for 5 of the required 10 minutes.
    expect(detect({ samples: stationarySamples(5) })).toBeNull();
  });

  it('does not fire on a single sample', () => {
    expect(detect({ samples: [{ coordinates: SPOT, at: minutesAgo(30) }] })).toBeNull();
  });

  it('does not fire when tracking only just started', () => {
    // Two samples a few seconds apart can't prove ten minutes of anything.
    expect(
      detect({
        samples: [
          { coordinates: SPOT, at: new Date(NOW.getTime() - 20_000) },
          { coordinates: SPOT, at: NOW },
        ],
      }),
    ).toBeNull();
  });

  it('does not fire when the location feed dried up', () => {
    // A phone that stopped *reporting* 30 minutes ago is a connectivity
    // problem, not a stationary traveller — and telling them "you've been
    // stopped for 10 minutes" would simply be false.
    expect(
      detect({
        samples: [
          { coordinates: SPOT, at: minutesAgo(45) },
          { coordinates: SPOT, at: minutesAgo(30) },
        ],
      }),
    ).toBeNull();
  });

  it('does not fire when the traveller has drifted beyond the stopped radius', () => {
    expect(detect({ samples: movingSamples(12) })).toBeNull();
  });

  it('honours a custom stopped threshold', () => {
    const shortRules: AlertRules = { ...RULES, stoppedMinutes: 3 };
    expect(detect({ samples: stationarySamples(4), rules: shortRules })).toBe('stopped');
  });
});

// ─── Late ────────────────────────────────────────────────────────────────────

describe('detect — late', () => {
  it('fires once past the ETA by more than the threshold', () => {
    expect(
      detect({
        eta: new Date(NOW.getTime() - 15 * 60_000),
        samples: movingSamples(12),
      }),
    ).toBe('late');
  });

  it('does not fire exactly on the threshold boundary', () => {
    expect(
      detect({
        eta: new Date(NOW.getTime() - RULES.lateMinutes * 60_000),
        samples: movingSamples(12),
      }),
    ).toBeNull();
  });
});

// ─── Off route ───────────────────────────────────────────────────────────────

describe('detect — off route', () => {
  it('fires when far from every point on the planned route', () => {
    expect(detect({ offRouteMeters: 800 })).toBe('off-route');
  });

  it('does not fire when there is no route to be off', () => {
    expect(detect({ offRouteMeters: null })).toBeNull();
  });
});

// ─── Precedence ──────────────────────────────────────────────────────────────

describe('detect — precedence', () => {
  it('reports "stopped" ahead of "late" when both apply', () => {
    // A traveller who has stopped is nearly always also late. "You've been
    // stopped for 10 minutes" is the more actionable of the two.
    expect(
      detect({
        samples: stationarySamples(11),
        eta: new Date(NOW.getTime() - 30 * 60_000),
        offRouteMeters: 900,
      }),
    ).toBe('stopped');
  });

  it('reports "late" ahead of "off-route" when both apply', () => {
    expect(
      detect({
        samples: movingSamples(12),
        eta: new Date(NOW.getTime() - 30 * 60_000),
        offRouteMeters: 900,
      }),
    ).toBe('late');
  });
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

describe('safety check lifecycle', () => {
  const USER = 'user-1';
  const JOURNEY = 'journey-1';

  it('raises a check in the PENDING state with the location attached', async () => {
    const check = await service().raise(USER, JOURNEY, 'stopped', SPOT, RULES);

    expect(check.status).toBe('PENDING');
    expect(check.reason).toBe('stopped');
    expect(check.location).toEqual(SPOT);
    expect(check.escalatedAt).toBeNull();
  });

  it('stamps the escalation deadline from the rules', async () => {
    // Persisted, not held in memory: a Cloud Function enforces this same
    // deadline, so guardians are alerted even if the app is force-quit or the
    // phone dies before the countdown finishes.
    const at = new Date('2026-10-05T12:00:00Z');
    const check = await service().raise(USER, JOURNEY, 'stopped', SPOT, RULES, at);

    expect(check.escalateAt.getTime()).toBe(at.getTime() + RULES.noReplyMinutes * 60_000);
  });

  it('honours a custom no-reply window', async () => {
    const at = new Date('2026-10-05T12:00:00Z');
    const urgent = { ...RULES, noReplyMinutes: 1 };
    const check = await service().raise(USER, JOURNEY, 'late', SPOT, urgent, at);

    expect(check.escalateAt.getTime()).toBe(at.getTime() + 60_000);
  });

  it('records a check raised without a location fix', async () => {
    const check = await service().raise(USER, JOURNEY, 'late', null, RULES);
    expect(check.location).toBeNull();
  });

  it('resolves and escalates without throwing', async () => {
    const svc = service();
    const confirmed = await svc.raise(USER, JOURNEY, 'stopped', SPOT, RULES);
    await expect(svc.confirm(USER, JOURNEY, confirmed.id)).resolves.toBeUndefined();

    const extended = await svc.raise(USER, JOURNEY, 'late', SPOT, RULES);
    await expect(svc.extend(USER, JOURNEY, extended.id, 15)).resolves.toBeUndefined();

    const escalated = await svc.raise(USER, JOURNEY, 'off-route', SPOT, RULES);
    await expect(svc.escalate(USER, JOURNEY, escalated.id, SPOT, 42)).resolves.toBeUndefined();
  });
});

// ─── Copy ────────────────────────────────────────────────────────────────────

describe('describeSafetyCheckReason', () => {
  it('states the real threshold rather than a hard-coded number', () => {
    const custom: AlertRules = { ...RULES, stoppedMinutes: 25 };
    expect(describeSafetyCheckReason('stopped', custom, null)).toContain('25 minutes');
  });

  it('names a nearby place when one is known, and omits it otherwise', () => {
    expect(describeSafetyCheckReason('stopped', RULES, "Queen's Road")).toContain("near Queen's Road");
    expect(describeSafetyCheckReason('stopped', RULES, null)).not.toContain('near');
  });

  it('has copy for every reason', () => {
    for (const reason of ['late', 'stopped', 'off-route'] as const) {
      expect(describeSafetyCheckReason(reason, RULES, null).length).toBeGreaterThan(20);
    }
  });
});
