import { useState, useCallback, useEffect, useRef } from 'react';
import type { Workout, LiftConfig, SetResult, ComputedSet, PreviousSetData, ProgressionProposal, ScheduleEntry, DayFlags, CardioActivity, AppSettings } from './model/index.js';
import { computeProgression, FLAG_SENTINEL } from './model/index.js';
import {
  appendLogRows, buildLogRow, readLogZone, findPreviousWorkoutSets,
  writeConfigValues, readSchedule, writeSchedule,
  writeWorkoutDefs, readWorkoutDefs, updateLogRows, deleteLogSession,
  writeCardioActivities, readCardioActivities, readConfigZone,
  syncScheduleWithCalendar, generateStrongerId, withAuthRetry,
} from './google/index.js';
import type { LiftGoal } from './google/index.js';
import type { CalendarSyncResult } from './google/index.js';
import type { WorkoutDefinition } from './data/sample-workouts.js';
import type { ParsedLogRow } from './google/index.js';
import { buildWorkoutsFromConfigs, workoutDefinitions, defaultCardioActivities } from './data/sample-workouts.js';
import { WorkoutSelect } from './components/WorkoutSelect.js';
import { WorkoutView } from './components/WorkoutView.js';
import { WorkoutEditor } from './components/WorkoutEditor.js';
import { ExerciseLibrary } from './components/ExerciseLibrary.js';
import { ExerciseEditor } from './components/ExerciseEditor.js';
import { ProgressionReview } from './components/ProgressionReview.js';
import { CalendarView, SessionDetail } from './components/CalendarView.js';
import type { LogSession } from './components/CalendarView.js';
import { ProgressView } from './components/ProgressView.js';
import { SettingsView } from './components/SettingsView.js';
import { GoogleAuth } from './components/GoogleAuth.js';
import { useHashRouter } from './hooks/useHashRouter.js';
import { loadDraft, saveDraft, clearDraft } from './hooks/useWorkoutDraft.js';
import { clearSentinel as clearTimerSentinel } from './hooks/useRestTimer.js';
import './App.css';

const DEFAULT_APP_SETTINGS: AppSettings = {
  showRestTimer: true,
  showSetComments: true,
  keepScreenOn: true,
};

function App() {
  const { route, navigateTo, replaceTo } = useHashRouter();
  const [loading, setLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [previousSets, setPreviousSets] = useState<PreviousSetData[][] | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [configs, setConfigs] = useState<LiftConfig[]>([]);
  const [definitions, setDefinitions] = useState<WorkoutDefinition[]>([]);
  const [progressionProposals, setProgressionProposals] = useState<ProgressionProposal[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [logRows, setLogRows] = useState<ParsedLogRow[]>([]);
  const [viewingSession, setViewingSession] = useState<LogSession | null>(null);
  const [cardioActivities, setCardioActivities] = useState<CardioActivity[]>([]);
  const [liftGoals, setLiftGoals] = useState<LiftGoal[]>([]);
  const [draftResults, setDraftResults] = useState<SetResult[][] | null>(null);
  const [pendingFinish, setPendingFinish] = useState<{
    workout: Workout;
    results: SetResult[][];
    endTime: string;
  } | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const settingsRef = useRef(new Map<string, string>());

  const loadScheduleData = useCallback(async () => {
    try {
      const entries = await readSchedule();
      setSchedule(entries);
    } catch {
      // Silently ignore — schedule data is optional
    }
  }, []);

  const loadLogData = useCallback(async () => {
    try {
      const rows = await readLogZone();
      setLogRows(rows);
    } catch {
      // Silently ignore — log data is optional
    }
  }, []);

  // Load all data on mount
  useEffect(() => {
    async function init() {
      try {
        const cfgs = await readConfigZone();
        const loadedConfigs = cfgs ?? [];
        const liftNames = new Map(loadedConfigs.map((c) => [c.id, c.name]));
        const [defs, cardio] = await Promise.all([
          readWorkoutDefs(liftNames),
          readCardioActivities(),
        ]);
        const loadedDefs = defs ?? workoutDefinitions;
        const loadedCardio = cardio ?? [...defaultCardioActivities];

        setConfigs(loadedConfigs);
        setDefinitions(loadedDefs);
        setCardioActivities(loadedCardio);
        setWorkouts(buildWorkoutsFromConfigs(loadedConfigs, loadedDefs));

        void loadScheduleData();
        void loadLogData();
      } catch (err) {
        console.error('Failed to load app data:', err);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [loadScheduleData, loadLogData]);

  const handleDisconnected = useCallback(() => {
    setActiveWorkout(null);
    setPreviousSets(null);
    setWorkouts([]);
    setConfigs([]);
    setDefinitions([]);
    setStartTime(null);
    setProgressionProposals(null);
    setSchedule([]);
    setLogRows([]);
    setCardioActivities([]);
    replaceTo({ view: 'list' });
  }, [replaceTo]);

  const loadPreviousSets = useCallback(async (workoutId: string) => {
    try {
      const rows = await readLogZone();
      const prev = findPreviousWorkoutSets(rows, workoutId);
      setPreviousSets(prev);
    } catch {
      // Silently ignore — previous data is optional context
    }
  }, []);

  const handleSelectWorkout = useCallback((workout: Workout) => {
    const draft = loadDraft();
    if (draft && draft.workoutId === workout.id) {
      setStartTime(draft.startTime);
      setDraftResults(draft.results.length > 0 ? draft.results : null);
    } else {
      const now = new Date().toISOString();
      setStartTime(now);
      setDraftResults(null);
      saveDraft({ workoutId: workout.id, startTime: now, results: [] });
    }
    setActiveWorkout(workout);
    setPreviousSets(null);
    navigateTo({ view: 'workout', workoutId: workout.id });
    void loadPreviousSets(workout.id);
  }, [loadPreviousSets, navigateTo]);

  const handleFinish = useCallback(
    (workout: Workout, results: SetResult[][]) => {
      const endTime = new Date().toISOString();
      setPendingFinish({ workout, results, endTime });

      const workoutDef = definitions.find((d) => d.id === workout.id);
      if (workoutDef && configs.length > 0) {
        const proposals = computeProgression(workout.exercises, results, configs, workoutDef.templates);
        setProgressionProposals(proposals);
      } else {
        setProgressionProposals([]);
      }
    },
    [configs, definitions],
  );

  const handleProgressionConfirm = useCallback(
    (updates: Map<string, { topSetWeight: number; backoffWeight: number }>) => {
      clearDraft();
      clearTimerSentinel();

      if (pendingFinish && startTime) {
        const { workout, results, endTime } = pendingFinish;
        void logWorkoutResults(workout, results, startTime, endTime).then(() => {
          void loadLogData();
        });
      }

      const updatedConfigs = configs.map((c) => {
        const update = updates.get(c.id);
        if (!update) return c;
        return { ...c, topSetWeight: update.topSetWeight, backoffWeight: update.backoffWeight };
      });

      void writeConfigValues(updatedConfigs);

      setConfigs(updatedConfigs);
      setWorkouts(buildWorkoutsFromConfigs(updatedConfigs, definitions));
      setProgressionProposals(null);
      setPendingFinish(null);
      setActiveWorkout(null);
      setStartTime(null);
      setPreviousSets(null);
      navigateTo({ view: 'list' });
    },
    [startTime, pendingFinish, configs, definitions, navigateTo, loadLogData],
  );

  const handleProgressionBack = useCallback(() => {
    setProgressionProposals(null);
    setPendingFinish(null);
  }, []);

  const handleBack = useCallback(() => {
    setActiveWorkout(null);
    setStartTime(null);
    setPreviousSets(null);
    setDraftResults(null);
    navigateTo({ view: 'list' });
  }, [navigateTo]);

  const handleScheduleAssign = useCallback(
    (date: string, workoutId: string) => {
      const updated = [...schedule, { date, workoutId, strongerId: generateStrongerId() }];
      setSchedule(updated);
      void withAuthRetry(() => writeSchedule(updated));
    },
    [schedule],
  );

  const handleBulkSchedule = useCallback(
    (entries: ScheduleEntry[]) => {
      const datesToRest = new Set(
        entries.filter((e) => e.workoutId === '__rest__').map((e) => e.date),
      );
      const toAdd = entries.filter((e) => e.workoutId !== '__rest__');

      let updated = schedule.map((e) => {
        if (datesToRest.has(e.date) && e.workoutId && e.workoutId !== FLAG_SENTINEL) {
          return { ...e, workoutId: '' };
        }
        return e;
      });

      for (const entry of toAdd) {
        const exists = updated.some((e) => e.date === entry.date && e.workoutId === entry.workoutId);
        if (!exists) {
          updated.push({ ...entry, strongerId: entry.strongerId ?? generateStrongerId() });
        }
      }

      setSchedule(updated);
      void withAuthRetry(() => writeSchedule(updated));
    },
    [schedule],
  );

  const handleScheduleRemove = useCallback(
    (date: string, workoutId: string) => {
      let blanked = false;
      const updated = schedule.map((e) => {
        if (!blanked && e.date === date && e.workoutId === workoutId && e.workoutId !== FLAG_SENTINEL) {
          blanked = true;
          return { ...e, workoutId: '' };
        }
        return e;
      });
      setSchedule(updated);
      void withAuthRetry(() => writeSchedule(updated));
    },
    [schedule],
  );

  const handleUpdateFlags = useCallback(
    (date: string, flags: DayFlags) => {
      const hasFlags = flags.home || flags.elsewhere || flags.travel || flags.visitors || flags.blocked;
      const flagIdx = schedule.findIndex((e) => e.date === date && e.workoutId === FLAG_SENTINEL);
      let updated: ScheduleEntry[];
      if (flagIdx >= 0) {
        if (hasFlags) {
          updated = schedule.map((e, i) => i === flagIdx ? { ...e, flags } : e);
        } else {
          updated = schedule.filter((_, i) => i !== flagIdx);
        }
      } else if (hasFlags) {
        updated = [...schedule, { date, workoutId: FLAG_SENTINEL, flags }];
      } else {
        return;
      }
      setSchedule(updated);
      void withAuthRetry(() => writeSchedule(updated));
    },
    [schedule],
  );

  const handleCalendarOpenWorkout = useCallback(
    (workoutId: string) => {
      const match = workouts.find((w) => w.id === workoutId);
      if (match) handleSelectWorkout(match);
    },
    [workouts, handleSelectWorkout],
  );

  const handleSyncCalendar = useCallback(
    async (calendarId: string): Promise<CalendarSyncResult> => {
      const resolveWorkoutName = (workoutId: string): string | null => {
        if (workoutId.startsWith('cardio:')) {
          const c = cardioActivities.find((a) => a.id === workoutId.slice('cardio:'.length));
          return c?.name ?? null;
        }
        return workouts.find((wk) => wk.id === workoutId)?.name ?? null;
      };

      const resolveWorkoutId = (name: string): string | null => {
        const w = workouts.find((wk) => wk.name === name);
        if (w) return w.id;
        const c = cardioActivities.find((a) => a.name === name);
        if (c) return `cardio:${c.id}`;
        return null;
      };

      const { updatedSchedule, result } = await withAuthRetry(() =>
        syncScheduleWithCalendar(calendarId, schedule, resolveWorkoutName, resolveWorkoutId),
      );

      setSchedule(updatedSchedule);
      void withAuthRetry(() => writeSchedule(updatedSchedule));
      return result;
    },
    [schedule, workouts, cardioActivities],
  );

  const handleUpdateLogRows = useCallback(
    (sessionDate: string, sessionWorkoutId: string, sessionStartTime: string, updatedRows: ParsedLogRow[]) => {
      setLogRows((prev) => {
        const next = [...prev];
        for (const updated of updatedRows) {
          const idx = next.findIndex(
            (r) =>
              r.date === sessionDate &&
              r.workoutId === sessionWorkoutId &&
              r.startTime === sessionStartTime &&
              r.exerciseName === updated.exerciseName &&
              r.setNumber === updated.setNumber,
          );
          if (idx >= 0) next[idx] = updated;
        }
        return next;
      });
      void withAuthRetry(() => updateLogRows(sessionDate, sessionWorkoutId, sessionStartTime, updatedRows));
    },
    [],
  );

  const handleDeleteSession = useCallback(
    (sessionDate: string, sessionWorkoutId: string, sessionStartTime: string) => {
      setLogRows((prev) =>
        prev.filter(
          (r) => !(r.date === sessionDate && r.workoutId === sessionWorkoutId && r.startTime === sessionStartTime),
        ),
      );
      void withAuthRetry(() => deleteLogSession(sessionDate, sessionWorkoutId, sessionStartTime));
    },
    [],
  );

  const handleViewSession = useCallback((session: LogSession) => {
    setViewingSession(session);
  }, []);

  const handleViewSessionSave = useCallback(
    (updatedRows: ParsedLogRow[]) => {
      if (!viewingSession) return;
      const { date, workoutId, startTime } = viewingSession.key;
      handleUpdateLogRows(date, workoutId, startTime, updatedRows);
    },
    [viewingSession, handleUpdateLogRows],
  );

  const handleViewSessionClose = useCallback(() => {
    setViewingSession(null);
  }, []);

  const handleGoToList = useCallback(() => navigateTo({ view: 'list' }), [navigateTo]);
  const handleOpenCalendar = useCallback(() => navigateTo({ view: 'calendar' }), [navigateTo]);
  const handleOpenExercises = useCallback(() => navigateTo({ view: 'exercises' }), [navigateTo]);
  const handleOpenProgress = useCallback(() => navigateTo({ view: 'progress' }), [navigateTo]);
  const handleOpenSettings = useCallback(() => navigateTo({ view: 'settings' }), [navigateTo]);

  const handleLiftGoalChange = useCallback((liftId: string, weight: number | null) => {
    setLiftGoals((prev) => {
      const updated = prev.filter((g) => g.liftId !== liftId);
      if (weight !== null) updated.push({ liftId, weight });
      return updated;
    });
  }, []);

  const handleAppSettingChange = useCallback((key: keyof AppSettings, value: boolean) => {
    setAppSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleImportComplete = useCallback(() => {
    void loadLogData();
  }, [loadLogData]);

  const handleEditWorkout = useCallback((workoutId: string) => {
    navigateTo({ view: 'editor', workoutId });
  }, [navigateTo]);

  const handleNewWorkout = useCallback(() => {
    navigateTo({ view: 'editor' });
  }, [navigateTo]);

  const handleDuplicateWorkout = useCallback(
    (workoutId: string) => {
      const source = definitions.find((d) => d.id === workoutId);
      if (!source) return;
      const newId = generateStrongerId();
      const newDef = { ...source, id: newId, name: `${source.name} (Copy)`, favorite: false };
      const updatedDefs = [...definitions, newDef];
      setDefinitions(updatedDefs);
      setWorkouts(buildWorkoutsFromConfigs(configs, updatedDefs));
      void withAuthRetry(() => writeWorkoutDefs(updatedDefs));
      navigateTo({ view: 'editor', workoutId: newId });
    },
    [definitions, configs, navigateTo],
  );

  const handleDeleteWorkoutFromList = useCallback(
    (workoutId: string) => {
      if (!confirm('Delete this workout?')) return;
      const updatedDefs = definitions.filter((d) => d.id !== workoutId);
      setDefinitions(updatedDefs);
      setWorkouts(buildWorkoutsFromConfigs(configs, updatedDefs));
      void withAuthRetry(() => writeWorkoutDefs(updatedDefs));
    },
    [definitions, configs],
  );

  const handleToggleFavorite = useCallback(
    (workoutId: string, favorite: boolean) => {
      const updatedDefs = definitions.map((d) => d.id === workoutId ? { ...d, favorite } : d);
      setDefinitions(updatedDefs);
      setWorkouts(buildWorkoutsFromConfigs(configs, updatedDefs));
      void withAuthRetry(() => writeWorkoutDefs(updatedDefs));
    },
    [definitions, configs],
  );

  const handleCardioSave = useCallback(
    (updated: CardioActivity[]) => {
      setCardioActivities(updated);
      void withAuthRetry(() => writeCardioActivities(updated));
    },
    [],
  );

  const handleEditorCancel = useCallback(() => {
    navigateTo({ view: 'list' });
  }, [navigateTo]);

  const handleDeleteWorkout = useCallback(
    (workoutId: string) => {
      const updatedDefs = definitions.filter((d) => d.id !== workoutId);
      setDefinitions(updatedDefs);
      setWorkouts(buildWorkoutsFromConfigs(configs, updatedDefs));
      void withAuthRetry(() => writeWorkoutDefs(updatedDefs));
      navigateTo({ view: 'list' });
    },
    [definitions, configs, navigateTo],
  );

  const handleEditExercise = useCallback((exerciseId: string) => {
    navigateTo({ view: 'exerciseEditor', exerciseId });
  }, [navigateTo]);

  const handleNewExercise = useCallback(() => {
    navigateTo({ view: 'exerciseEditor' });
  }, [navigateTo]);

  const handleExerciseEditorCancel = useCallback(() => {
    navigateTo({ view: 'exercises' });
  }, [navigateTo]);

  const handleExerciseSave = useCallback(
    (config: LiftConfig) => {
      const isNew = !configs.some((c) => c.id === config.id);
      const updatedConfigs = isNew
        ? [...configs, config]
        : configs.map((c) => (c.id === config.id ? config : c));

      setConfigs(updatedConfigs);
      setWorkouts(buildWorkoutsFromConfigs(updatedConfigs, definitions));
      void withAuthRetry(() => writeConfigValues(updatedConfigs));
      navigateTo({ view: 'exercises' });
    },
    [configs, definitions, navigateTo],
  );

  const handleEditorSave = useCallback(
    (definition: WorkoutDefinition) => {
      const isNew = !definitions.some((d) => d.id === definition.id);
      const updatedDefs = isNew
        ? [...definitions, definition]
        : definitions.map((d) => (d.id === definition.id ? definition : d));

      setDefinitions(updatedDefs);
      setWorkouts(buildWorkoutsFromConfigs(configs, updatedDefs));
      void withAuthRetry(() => writeWorkoutDefs(updatedDefs));
      navigateTo({ view: 'list' });
    },
    [definitions, configs, navigateTo],
  );

  // Deep-link resolution: when workouts are loaded, auto-select a workout from the URL
  useEffect(() => {
    if (loading || workouts.length === 0) return;
    if (route.view !== 'workout') return;
    if (activeWorkout?.id === route.workoutId) return;

    const match = workouts.find((w) => w.id === route.workoutId);
    if (match) {
      const draft = loadDraft();
      if (draft && draft.workoutId === match.id) {
        setStartTime(draft.startTime);
        setDraftResults(draft.results.length > 0 ? draft.results : null);
      } else {
        setStartTime(new Date().toISOString());
        setDraftResults(null);
      }
      setActiveWorkout(match);
      setPreviousSets(null);
      void loadPreviousSets(match.id);
    } else {
      replaceTo({ view: 'list' });
    }
  }, [loading, workouts, route, activeWorkout?.id, loadPreviousSets, replaceTo]);

  // Sync state when the user presses the browser back button
  useEffect(() => {
    if (route.view === 'list' && activeWorkout && !progressionProposals) {
      setActiveWorkout(null);
      setStartTime(null);
      setPreviousSets(null);
      setDraftResults(null);
    }
  }, [route, activeWorkout, progressionProposals]);

  // Show loading spinner while data loads
  if (loading) {
    return (
      <div className="auth-screen">
        <p className="auth-status">Loading…</p>
      </div>
    );
  }

  if (progressionProposals && pendingFinish) {
    const totalSets = pendingFinish.results.flat().length;
    const completedSets = pendingFinish.results.flat().filter((s) => s.completed).length;
    return (
      <ProgressionReview
        proposals={progressionProposals}
        completedSets={completedSets}
        totalSets={totalSets}
        onConfirm={handleProgressionConfirm}
        onBack={handleProgressionBack}
      />
    );
  }

  if (activeWorkout) {
    return (
      <WorkoutView
        workout={activeWorkout}
        previousSets={previousSets}
        startTime={startTime ?? new Date().toISOString()}
        draftResults={draftResults}
        appSettings={appSettings}
        configs={configs}
        onBack={handleBack}
        onFinish={handleFinish}
      />
    );
  }

  const navBar = (
    <GoogleAuth
      onDisconnected={handleDisconnected}
      onGoToList={handleGoToList}
      onOpenCalendar={handleOpenCalendar}
      onOpenExercises={handleOpenExercises}
      onOpenProgress={handleOpenProgress}
      onOpenSettings={handleOpenSettings}
    />
  );

  if (route.view === 'exerciseEditor') {
    const editConfig = route.exerciseId ? configs.find((c) => c.id === route.exerciseId) : undefined;
    return (
      <>
        {navBar}
        <ExerciseEditor
          existing={editConfig}
          allConfigs={configs}
          onSave={handleExerciseSave}
          onCancel={handleExerciseEditorCancel}
        />
      </>
    );
  }

  if (route.view === 'exercises') {
    return (
      <>
        {navBar}
        <ExerciseLibrary configs={configs} onEdit={handleEditExercise} onNew={handleNewExercise} />
      </>
    );
  }

  if (route.view === 'editor') {
    const editDef = route.workoutId ? definitions.find((d) => d.id === route.workoutId) : undefined;
    return (
      <>
        {navBar}
        <WorkoutEditor
          existing={editDef}
          allDefinitions={definitions}
          configs={configs}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          onDelete={editDef ? handleDeleteWorkout : undefined}
        />
      </>
    );
  }

  if (route.view === 'calendar') {
    return (
      <>
        {navBar}
        <CalendarView
          workouts={workouts}
          cardioActivities={cardioActivities}
          schedule={schedule}
          logRows={logRows}
          onAssign={handleScheduleAssign}
          onRemove={handleScheduleRemove}
          onOpenWorkout={handleCalendarOpenWorkout}
          onUpdateLogRows={handleUpdateLogRows}
          onDeleteSession={handleDeleteSession}
          onBulkSchedule={handleBulkSchedule}
          onUpdateFlags={handleUpdateFlags}
          onSyncCalendar={handleSyncCalendar}
        />
      </>
    );
  }

  if (route.view === 'progress') {
    return (
      <>
        {navBar}
        <ProgressView logRows={logRows} liftGoals={liftGoals} onLiftGoalChange={handleLiftGoalChange} />
      </>
    );
  }

  if (route.view === 'settings') {
    return (
      <>
        {navBar}
        <SettingsView
          spreadsheetId=""
          onImportComplete={handleImportComplete}
          appendLogRows={(_, rows) => appendLogRows(rows)}
          onDisconnectSheet={handleDisconnected}
          appSettings={appSettings}
          onAppSettingChange={handleAppSettingChange}
        />
      </>
    );
  }

  const configIds = new Set(configs.map((c) => c.id));
  const missingLiftIds = [...new Set(
    definitions.flatMap((d) => d.templates.map((t) => t.liftId))
  )].filter((id) => !configIds.has(id));

  const workoutNames = new Map<string, string>(workouts.map((w) => [w.id, w.name]));

  if (viewingSession) {
    return (
      <>
        {navBar}
        <SessionDetail
          session={viewingSession}
          workoutNames={workoutNames}
          onSave={handleViewSessionSave}
          onClose={handleViewSessionClose}
        />
      </>
    );
  }

  return (
    <>
      {navBar}
      <WorkoutSelect
        workouts={workouts}
        missingLiftIds={missingLiftIds}
        schedule={schedule}
        logRows={logRows}
        onSelect={handleSelectWorkout}
        onViewSession={handleViewSession}
        onEdit={handleEditWorkout}
        onDuplicate={handleDuplicateWorkout}
        onDelete={handleDeleteWorkoutFromList}
        onNew={handleNewWorkout}
        onToggleFavorite={handleToggleFavorite}
        cardioActivities={cardioActivities}
        onCardioSave={handleCardioSave}
      />
    </>
  );
}

export default App;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function logWorkoutResults(
  workout: Workout,
  results: SetResult[][],
  startTime: string,
  endTime: string,
): Promise<void> {
  const now = new Date(endTime);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const ctx = { date, startTime, endTime, workoutId: workout.id };

  const rows: (string | number | boolean)[][] = [];
  for (let ei = 0; ei < workout.exercises.length; ei++) {
    const exercise = workout.exercises[ei];
    for (let si = 0; si < results[ei].length; si++) {
      const planned: ComputedSet =
        si < exercise.sets.length
          ? exercise.sets[si]
          : {
              setType: results[ei][si].actualSetType,
              weight: results[ei][si].actualWeight,
              minReps: results[ei][si].actualReps,
              maxReps: results[ei][si].actualReps,
              amrap: false,
            };
      rows.push(
        buildLogRow(ctx, exercise.name, exercise.liftId, si + 1, results[ei][si].actualSetType, planned, results[ei][si]),
      );
    }
  }

  await appendLogRows(rows);
}
