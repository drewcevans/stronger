import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Workout, ScheduleEntry, CardioActivity } from '../model/index.js';
import type { CalendarListEntry, CalendarPushResult } from '../google/index.js';
import { listWritableCalendars, pushScheduleToCalendar } from '../google/index.js';
import { saveCalendarId, loadCalendarId } from '../google/index.js';
import { Upload, CheckCircle, AlertCircle, Loader, X, CalendarCheck } from 'lucide-react';

interface CalendarPushProps {
  workouts: Workout[];
  cardioActivities: CardioActivity[];
  schedule: ScheduleEntry[];
  onClose: () => void;
  onUpdateSchedule: (entries: ScheduleEntry[]) => void;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Find the next Monday on or after today, returned as YYYY-MM-DD. */
function nextMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const yyyy = mon.getFullYear();
  const mm = String(mon.getMonth() + 1).padStart(2, '0');
  const dd = String(mon.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

type PushStatus = 'idle' | 'pushing' | 'success' | 'error';

export function CalendarPush({ workouts, cardioActivities, schedule, onClose, onUpdateSchedule }: CalendarPushProps) {
  // Weekly day → activity mapping (7 entries, empty string = rest day)
  const [daySlots, setDaySlots] = useState<string[]>(Array(7).fill(''));
  const [weeks, setWeeks] = useState(4);
  const [startDate, setStartDate] = useState(nextMonday);

  // Calendar list
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Push status
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');
  const [pushResult, setPushResult] = useState<CalendarPushResult | null>(null);

  // Workout lookup map
  const workoutMap = useMemo(() => {
    const map = new Map<string, Workout>();
    for (const w of workouts) map.set(w.id, w);
    return map;
  }, [workouts]);

  // Cardio lookup map
  const cardioMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cardioActivities) map.set(`cardio:${c.id}`, c.name);
    return map;
  }, [cardioActivities]);

  // Load user's writable calendars on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingCalendars(true);
    setCalendarError(null);

    listWritableCalendars()
      .then((cals) => {
        if (cancelled) return;
        setCalendars(cals);
        // Use the saved calendar if it still exists, otherwise fall back
        // to the primary calendar or the first writable one.
        const saved = loadCalendarId();
        const savedCal = saved ? cals.find((c) => c.id === saved) : null;
        const primary = cals.find((c) => c.primary);
        setSelectedCalendarId(savedCal?.id ?? primary?.id ?? cals[0]?.id ?? '');
        setLoadingCalendars(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setCalendarError(err instanceof Error ? err.message : String(err));
        setLoadingCalendars(false);
      });

    return () => { cancelled = true; };
  }, []);

  const handleDayChange = useCallback((dayIndex: number, workoutId: string) => {
    setDaySlots((prev) => {
      const next = [...prev];
      next[dayIndex] = workoutId;
      return next;
    });
  }, []);

  const hasSlots = daySlots.some((id) => id !== '');

  // Schedule entries from today onward
  const futureEntries = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return schedule.filter((e) => e.date >= todayStr);
  }, [schedule]);

  const canPush = futureEntries.length > 0 && selectedCalendarId && pushStatus !== 'pushing';

  // Generate ScheduleEntry[] from the weekly planner
  const generateScheduleEntries = useCallback((): ScheduleEntry[] => {
    const entries: ScheduleEntry[] = [];
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    for (let week = 0; week < weeks; week++) {
      for (let day = 0; day < 7; day++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const wid = daySlots[day];
        if (wid) entries.push({ date: dateStr, workoutId: wid });
      }
    }
    return entries;
  }, [daySlots, startDate, weeks]);

  const [scheduleUpdated, setScheduleUpdated] = useState(false);

  const handleUpdateSchedule = useCallback(() => {
    const entries = generateScheduleEntries();
    onUpdateSchedule(entries);
    setScheduleUpdated(true);
    setTimeout(() => setScheduleUpdated(false), 2000);
  }, [generateScheduleEntries, onUpdateSchedule]);

  const handlePush = useCallback(async () => {
    if (!canPush) return;

    // Build entries from schedule (today onward), resolving workout/cardio names
    const entries = futureEntries
      .map((e) => {
        const cardioName = cardioMap.get(e.workoutId);
        if (cardioName) {
          return { date: e.date, workoutId: e.workoutId, workoutName: cardioName };
        }
        const w = workoutMap.get(e.workoutId);
        if (!w) return null;
        return { date: e.date, workoutId: e.workoutId, workoutName: w.name };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entries.length === 0) return;

    setPushStatus('pushing');
    setPushResult(null);

    try {
      const result = await pushScheduleToCalendar({
        calendarId: selectedCalendarId,
        entries,
      });
      setPushResult(result);
      setPushStatus(result.failed > 0 ? 'error' : 'success');
    } catch (err) {
      setPushResult({
        created: 0,
        skipped: 0,
        failed: 1,
        errors: [err instanceof Error ? err.message : String(err)],
      });
      setPushStatus('error');
    }
  }, [canPush, futureEntries, workoutMap, cardioMap, selectedCalendarId]);

  return (
    <div className="calendar-push">
      <div className="calendar-push-header">
        <h3>Planner</h3>
        <button className="calendar-push-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {/* Weekly schedule */}
      <div className="calendar-push-section">
        <label className="calendar-push-label">Weekly schedule</label>
        <div className="calendar-push-days">
          {DAY_NAMES.map((name, i) => (
            <div key={name} className="calendar-push-day-row">
              <span className="calendar-push-day-name">{name}</span>
              <select
                className="calendar-push-select"
                value={daySlots[i]}
                onChange={(e) => handleDayChange(i, e.target.value)}
              >
                <option value="">— Rest —</option>
                <optgroup label="Strength">
                  {workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
                {cardioActivities.length > 0 && (
                  <optgroup label="Cardio">
                    {cardioActivities.map((c) => (
                      <option key={c.id} value={`cardio:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Start date */}
      <div className="calendar-push-section">
        <label className="calendar-push-label" htmlFor="push-start-date">
          Start date (Monday)
        </label>
        <input
          id="push-start-date"
          type="date"
          className="calendar-push-input"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      {/* Number of weeks */}
      <div className="calendar-push-section">
        <label className="calendar-push-label" htmlFor="push-weeks">
          Number of weeks
        </label>
        <select
          id="push-weeks"
          className="calendar-push-select"
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 6, 8, 12].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'week' : 'weeks'}
            </option>
          ))}
        </select>
      </div>

      {/* Update Schedule button */}
      <button
        className="calendar-push-btn"
        onClick={handleUpdateSchedule}
        disabled={!hasSlots}
      >
        {scheduleUpdated ? (
          <>
            <CheckCircle size={16} /> Updated
          </>
        ) : (
          <>
            <CalendarCheck size={16} /> Update Schedule
          </>
        )}
      </button>

      {/* Divider */}
      <div className="calendar-push-divider" />

      {/* Push to Google Calendar */}
      <div className="calendar-push-section">
        <label className="calendar-push-label">Push to Google Calendar</label>
      </div>

      {/* Calendar picker */}
      <div className="calendar-push-section">
        <label className="calendar-push-label" htmlFor="push-calendar">
          Target calendar
        </label>
        {loadingCalendars ? (
          <div className="calendar-push-loading">
            <Loader size={16} className="spin" /> Loading calendars…
          </div>
        ) : calendarError ? (
          <div className="calendar-push-error">
            <AlertCircle size={16} /> {calendarError}
          </div>
        ) : calendars.length === 0 ? (
          <div className="calendar-push-error">
            <AlertCircle size={16} /> No writable calendars found
          </div>
        ) : (
          <select
            id="push-calendar"
            className="calendar-push-select"
            value={selectedCalendarId}
            onChange={(e) => {
              setSelectedCalendarId(e.target.value);
              saveCalendarId(e.target.value);
            }}
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.summary}{c.primary ? ' (primary)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Push button */}
      <button
        className="calendar-push-btn"
        onClick={handlePush}
        disabled={!canPush}
      >
        {pushStatus === 'pushing' ? (
          <>
            <Loader size={16} className="spin" /> Pushing…
          </>
        ) : (
          <>
            <Upload size={16} /> Push to Calendar
          </>
        )}
      </button>

      {/* Result feedback */}
      {pushResult && pushStatus === 'success' && (
        <div className="calendar-push-feedback calendar-push-feedback-success">
          <CheckCircle size={16} />
          Created {pushResult.created} event{pushResult.created !== 1 ? 's' : ''}{pushResult.skipped > 0 ? `, skipped ${pushResult.skipped} duplicate${pushResult.skipped !== 1 ? 's' : ''}` : ''}.
        </div>
      )}
      {pushResult && pushStatus === 'error' && (
        <div className="calendar-push-feedback calendar-push-feedback-error">
          <AlertCircle size={16} />
          <div>
            <p>
              Created {pushResult.created}, skipped {pushResult.skipped}, failed {pushResult.failed}.
            </p>
            {pushResult.errors.slice(0, 3).map((err, i) => (
              <p key={i} className="calendar-push-error-detail">{err}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
