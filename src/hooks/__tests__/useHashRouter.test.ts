import { describe, it, expect } from 'vitest';
import { parseHash, routeToHash } from '../useHashRouter.js';
import type { Route } from '../useHashRouter.js';

/* ------------------------------------------------------------------ */
/*  parseHash – pure function, no DOM required                         */
/* ------------------------------------------------------------------ */

describe('parseHash', () => {
  it('returns list for empty string', () => {
    expect(parseHash('')).toEqual({ view: 'list' });
  });

  it('returns list for bare hash', () => {
    expect(parseHash('#')).toEqual({ view: 'list' });
  });

  it('returns list for root path', () => {
    expect(parseHash('#/')).toEqual({ view: 'list' });
  });

  it('parses a workout route', () => {
    expect(parseHash('#/workout/squat-a')).toEqual({
      view: 'workout',
      workoutId: 'squat-a',
    });
  });

  it('parses a workout route without leading slash', () => {
    expect(parseHash('#workout/bench-b')).toEqual({
      view: 'workout',
      workoutId: 'bench-b',
    });
  });

  it('decodes percent-encoded workout IDs', () => {
    expect(parseHash('#/workout/my%20workout')).toEqual({
      view: 'workout',
      workoutId: 'my workout',
    });
  });

  it('parses the calendar route', () => {
    expect(parseHash('#/calendar')).toEqual({ view: 'calendar' });
  });

  it('parses the calendar route without leading slash', () => {
    expect(parseHash('#calendar')).toEqual({ view: 'calendar' });
  });

  it('returns list for unknown routes', () => {
    expect(parseHash('#/settings')).toEqual({ view: 'list' });
    expect(parseHash('#/workout/')).toEqual({ view: 'list' });
    expect(parseHash('#/workout/a/b')).toEqual({ view: 'list' });
  });

  it('ignores trailing content after workout ID with extra slashes', () => {
    expect(parseHash('#/workout/squat-a/extra')).toEqual({ view: 'list' });
  });
});

/* ------------------------------------------------------------------ */
/*  routeToHash – pure function                                        */
/* ------------------------------------------------------------------ */

describe('routeToHash', () => {
  it('returns / for list route', () => {
    expect(routeToHash({ view: 'list' })).toBe('/');
  });

  it('returns /workout/<id> for workout route', () => {
    expect(routeToHash({ view: 'workout', workoutId: 'squat-a' })).toBe(
      '/workout/squat-a',
    );
  });

  it('encodes special characters in workout ID', () => {
    expect(routeToHash({ view: 'workout', workoutId: 'my workout' })).toBe(
      '/workout/my%20workout',
    );
  });

  it('returns /calendar for calendar route', () => {
    expect(routeToHash({ view: 'calendar' })).toBe('/calendar');
  });

  it('round-trips through parseHash', () => {
    const routes: Route[] = [
      { view: 'list' },
      { view: 'workout', workoutId: 'bench-b' },
      { view: 'workout', workoutId: 'press-c' },
      { view: 'calendar' },
    ];
    for (const route of routes) {
      const hash = '#' + routeToHash(route);
      expect(parseHash(hash)).toEqual(route);
    }
  });
});
