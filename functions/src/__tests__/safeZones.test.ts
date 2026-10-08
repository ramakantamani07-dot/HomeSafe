/** Safe-zone hysteresis: what turns readings into "arrived" and "left". */
import { ZONE_CONFIRMATIONS, applyZoneReading, type ZoneTracking } from '../networkLocation/zones';

const fresh: ZoneTracking = { state: 'unknown', pendingState: null, pendingCount: 0 };

function run(readings: boolean[], start: ZoneTracking = fresh) {
  const events: (string | null)[] = [];
  let t = start;
  for (const inside of readings) {
    const next = applyZoneReading(t, inside);
    events.push(next.event);
    t = next;
  }
  return { events, final: t };
}

test('the first reading sets the state and never claims an arrival', () => {
  expect(run([true]).events).toEqual([null]);
  expect(run([true]).final.state).toBe('inside');
});

test(`a flip needs ${ZONE_CONFIRMATIONS} agreeing readings`, () => {
  const { events, final } = run([true, false, false]);
  expect(events).toEqual([null, null, 'left']);
  expect(final.state).toBe('outside');
});

test('a wobbling edge produces nothing', () => {
  expect(run([true, false, true, false, true]).events.every((e) => e === null)).toBe(true);
});

test('repeated readings never re-alert', () => {
  const { events } = run([false, true, true, true, true]);
  expect(events.filter(Boolean)).toEqual(['arrived']);
});
