/**
 * Journey timeline tests.
 *
 * The timeline is the last thing a traveller reads before sharing their
 * location, so the selection rules matter: a card describing the first thirty
 * seconds of a walk, or padded with 20-metre turns, tells them nothing about
 * the journey they are about to take.
 */

import { buildJourneyTimeline } from '../models/JourneyTimeline';
import type { RouteResult, RouteStep } from '../models/RouteResult';

const START = new Date('2026-10-05T21:39:00Z');

function step(name: string | null, distanceMeters: number, durationSeconds = 60): RouteStep {
  return { name, distanceMeters, durationSeconds, start: { latitude: 0, longitude: 0 } };
}

function route(steps: RouteStep[]): RouteResult {
  return {
    providerRouteId: null,
    coordinates: [],
    distanceMeters: steps.reduce((t, s) => t + s.distanceMeters, 0),
    durationSeconds: steps.reduce((t, s) => t + s.durationSeconds, 0),
    steps,
    calculatedAt: START,
  };
}

const build = buildJourneyTimeline;

describe('timeline shape', () => {
  it('always opens at the traveller and ends at the destination', () => {
    const entries = build(route([step('Mill Lane', 400)]), 'NN2 8ET', START);

    expect(entries[0].kind).toBe('start');
    expect(entries[entries.length - 1].kind).toBe('arrival');
    expect(entries[entries.length - 1].title).toBe('NN2 8ET');
  });

  it('shows just the endpoints when there is no route', () => {
    // Better two honest rows than a fabricated middle.
    const entries = build(null, 'NN2 8ET', START);
    expect(entries.map((e) => e.kind)).toEqual(['start', 'arrival']);
  });

  it('shows just the endpoints when the provider returned no steps', () => {
    const entries = build(route([]), 'NN2 8ET', START);
    expect(entries.map((e) => e.kind)).toEqual(['start', 'arrival']);
  });

  it('never exceeds five rows', () => {
    const many = Array.from({ length: 20 }, (_, i) => step(`Road ${i}`, 300 + i));
    const entries = build(route(many), 'NN2 8ET', START);
    expect(entries.length).toBeLessThanOrEqual(5);
  });
});

describe('leg selection', () => {
  it('drops turns too short to be a stretch of the journey', () => {
    const entries = build(
      route([step('Mill Lane', 900), step('Side Alley', 20), step('Glebe Road', 800)]),
      'NN2 8ET',
      START,
    );
    expect(entries.map((e) => e.title)).not.toContain('Side Alley');
  });

  it('drops unnamed steps rather than labelling them', () => {
    const entries = build(
      route([step('Mill Lane', 900), step(null, 700), step('Glebe Road', 800)]),
      'NN2 8ET',
      START,
    );
    const legs = entries.filter((e) => e.kind === 'leg');
    expect(legs.every((l) => l.title.length > 0)).toBe(true);
    expect(legs).toHaveLength(2);
  });

  it('picks the longest stretches, not merely the first ones', () => {
    // The opening steps of a real route are short ones leaving a building.
    // Taking them in order would describe the first thirty seconds and omit
    // the actual journey.
    const entries = build(
      route([
        step('Car Park', 160),
        step('Short Close', 170),
        step('Harlestone Road', 2000),
        step('Glebe Road', 1500),
      ]),
      'NN2 8ET',
      START,
    );
    const titles = entries.filter((e) => e.kind === 'leg').map((e) => e.title);
    expect(titles).toContain('Harlestone Road');
    expect(titles).toContain('Glebe Road');
  });

  it('keeps chosen legs in travel order, not in length order', () => {
    const entries = build(
      route([step('First Street', 400), step('Second Street', 3000)]),
      'NN2 8ET',
      START,
    );
    const titles = entries.filter((e) => e.kind === 'leg').map((e) => e.title);
    expect(titles).toEqual(['First Street', 'Second Street']);
  });

  it('falls back to short legs when nothing is long enough', () => {
    // A genuinely short walk still deserves a middle.
    const entries = build(
      route([step('Alley One', 40), step('Alley Two', 50)]),
      'NN2 8ET',
      START,
    );
    expect(entries.filter((e) => e.kind === 'leg').length).toBeGreaterThan(0);
  });

  it('marks only the dominant leg as the main road', () => {
    const entries = build(
      route([step('Mill Lane', 400), step('Glebe Road', 3000), step('Bank Street', 500)]),
      'NN2 8ET',
      START,
    );
    const withDetail = entries.filter((e) => e.kind === 'leg' && e.detail !== null);
    expect(withDetail).toHaveLength(1);
    expect(withDetail[0].title).toBe('Glebe Road');
  });
});

describe('times', () => {
  it('stamps the start row with the departure time', () => {
    const entries = build(route([step('Mill Lane', 400)]), 'NN2 8ET', START);
    expect(entries[0].meta).toBe(
      START.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    );
  });

  it('stamps arrival with departure plus the route duration', () => {
    const entries = build(route([step('Mill Lane', 400, 300)]), 'NN2 8ET', START);
    const expected = new Date(START.getTime() + 300_000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(entries[entries.length - 1].meta).toBe(expected);
  });

  it('leaves arrival time blank when there is no route to derive it from', () => {
    const entries = build(null, 'NN2 8ET', START);
    expect(entries[entries.length - 1].meta).toBeNull();
  });
});
