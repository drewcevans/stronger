import { useState, useCallback } from 'react';
import type { Workout, ScheduleEntry, CardioActivity } from '../model/index.js';
import { CheckCircle, X, CalendarCheck } from 'lucide-react';

interface CalendarPushProps {
  workouts: Workout[];
  cardioActivities: CardioActivity[];
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

export function CalendarPush({ workouts, cardioActivities, onClose, onUpdateSchedule }: CalendarPushProps) {
  // Weekly day → activity mapping (7 entries)
  // '' = no action (skip), '__rest__' = clear workouts, otherwise = workout/cardio id
  const [daySlots, setDaySlots] = useState<string[]>(Array(7).fill(''));
  const [weeks, setWeeks] = useState(4);
  const [startDate, setStartDate] = useState(nextMonday);

  const handleDayChange = useCallback((dayIndex: number, workoutId: string) => {
    setDaySlots((prev) => {
      const next = [...prev];
      next[dayIndex] = workoutId;
      return next;
    });
  }, []);

  const hasSlots = daySlots.some((id) => id !== '');

  // Generate ScheduleEntry[] from the weekly planner.
  // Additive: only emits entries for days with a selection (skips empty/no-action days).
  // __rest__ signals clearing all workouts for that date.
  const generateScheduleEntries = useCallback((): ScheduleEntry[] => {
    const entries: ScheduleEntry[] = [];
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    for (let week = 0; week < weeks; week++) {
      for (let day = 0; day < 7; day++) {
        const wid = daySlots[day];
        if (!wid) continue; // No action — skip this day
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        entries.push({ date: dateStr, workoutId: wid });
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
                <option value="">—</option>
                <option value="__rest__">— Rest —</option>
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
    </div>
  );
}
