import type { RouteResult, RouteStep } from '../models/RouteResult';
import { computeEta, formatDuration } from '../models/RouteResult';

/** A row in the Route screen's timeline (Option 15 `AI3`). */
export interface TimelineEntry {
  kind: 'start' | 'leg' | 'openPlace' | 'arrival';
  title: string;
  detail: string | null;
  /** "21:39" for fixed points, "3 min" for legs. */
  meta: string | null;
}

/**
 * The design shows 3–5 rows. Fewer reads as an empty card; more turns a
 * reassurance into a navigation list, which is explicitly not what this app is.
 */
const MIN_LEGS = 1;
const MAX_LEGS = 3;

/**
 * A leg shorter than this is a turn, not a stretch of the journey. Including
 * them produces "Mill Lane · 20 m" rows that tell a traveller nothing and push
 * the parts that matter off the card.
 */
const SIGNIFICANT_LEG_METERS = 150;

/**
 * Builds the journey timeline shown before starting (`AI3`).
 *
 * Lives in models rather than services because it is a pure function of its
 * arguments — no port, no state, nothing to inject. A service here would have
 * been a class wrapping one function, and screens would have had to reach past
 * the hook layer to call it.
 *
 * All the judgement about what counts as a meaningful leg is here rather than
 * in the screen, so it can be tested without rendering anything.
 */
export function buildJourneyTimeline(
  route: RouteResult | null,
  destinationName: string,
  startedAt: Date = new Date(),
): TimelineEntry[] {
    const arrivalAt = route ? computeEta(route.durationSeconds, startedAt) : null;

    const start: TimelineEntry = {
      kind: 'start',
      title: startTitle(route),
      detail: 'You, now',
      meta: formatClock(startedAt),
    };

    const arrival: TimelineEntry = {
      kind: 'arrival',
      title: destinationName,
      detail: 'Arrive',
      meta: arrivalAt ? formatClock(arrivalAt) : null,
    };

    if (!route || route.steps.length === 0) {
      // No step data — show the two endpoints rather than inventing a middle.
      return [start, arrival];
    }

    return [start, ...legs(route.steps), arrival];
  }

  /**
   * The first named road, which the design uses as the start row's title
   * ("Mill Lane"). Falls back to a plain label rather than an empty row.
   */
function startTitle(route: RouteResult | null): string {
    const named = route?.steps.find((s) => s.name !== null);
    return named?.name ?? 'Your location';
  }

  /**
   * Picks the legs worth showing: the longest significant stretches, in the
   * order they are travelled.
   *
   * Longest-first selection then re-sorted by position, rather than simply
   * taking the first three, because the opening steps of a route are usually
   * the short ones leaving a building — taking them in order would describe
   * the first thirty seconds and omit the actual journey.
   */
function legs(steps: RouteStep[]): TimelineEntry[] {
    const named = steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.name !== null);

    const significant = named.filter(
      ({ step }) => step.distanceMeters >= SIGNIFICANT_LEG_METERS,
    );
    const pool = significant.length >= MIN_LEGS ? significant : named;

    const chosen = [...pool]
      .sort((a, b) => b.step.distanceMeters - a.step.distanceMeters)
      .slice(0, MAX_LEGS)
      .sort((a, b) => a.index - b.index);

    const longest = chosen.reduce(
      (max, c) => Math.max(max, c.step.distanceMeters),
      0,
    );

    return chosen.map(({ step }) => ({
      kind: 'leg' as const,
      title: step.name as string,
      // Only the dominant leg earns the reassurance line; repeating it on
      // every row would make it noise.
      detail: step.distanceMeters === longest ? 'Main road most of the way' : null,
      meta: formatDuration(step.durationSeconds),
    }));
  }

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
