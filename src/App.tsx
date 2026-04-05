import { useState, useCallback, useEffect } from 'react';
import type { Workout, LiftConfig, SetResult, ComputedSet, PreviousSetData, ProgressionProposal, ScheduleEntry } from './model/index.js';
import { computeProgression } from './model/index.js';
import { appendLogRows, buildLogRow, buildCardioLogRow, readLogZone, findPreviousWorkoutSets, writeConfigValues, writeDefaultConfig, verifyScheduleTab, createScheduleTab, readSchedule, writeSchedule, writeWorkoutDefs, readWorkoutDefs, writeDefaultWorkoutDefs, updateLogRows, deleteLogSession } from './google/index.js';
import type { WorkoutDefinition } from './data/sample-workouts.js';
import type { CardioLogData, ParsedLogRow } from './google/index.js';
import { buildWorkoutsFromConfigs, workoutDefinitions } from './data/sample-workouts.js';
import { WorkoutSelect } from './components/WorkoutSelect.js';
import { WorkoutView } from './components/WorkoutView.js';
import { CardioView } from './components/CardioView.js';
import { WorkoutEditor } from './components/WorkoutEditor.js';
import { ExerciseLibrary } from './components/ExerciseLibrary.js';
import { ExerciseEditor } from './components/ExerciseEditor.js';
import { ProgressionReview } from './components/ProgressionReview.js';
import { CalendarView, SessionDetail } from './components/CalendarView.js';
import type { LogSession } from './components/CalendarView.js';
import { ProgressView } from './components/ProgressView.js';
import { SettingsView } from './components/SettingsView.js';
import { SetupPage } from './components/SetupPage.js';
import { GoogleAuth } from './components/GoogleAuth.js';
import { useHashRouter } from './hooks/useHashRouter.js';
import './App.css';

function App() {
  const { route, navigateTo, replaceTo } = useHashRouter();
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [previousSets, setPreviousSets] = useState<PreviousSetData[][] | null>(null);
  const [sheetConnected, setSheetConnected] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<LiftConfig[]>([]);
  const [definitions, setDefinitions] = useState<WorkoutDefinition[]>([]);
  const [progressionProposals, setProgressionProposals] = useState<ProgressionProposal[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [logRows, setLogRows] = useState<ParsedLogRow[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [viewingSession, setViewingSession] = useState<LogSession | null>(null);

  const handleConnected = useCallback(
    (loadedWorkouts: Workout[], loadedConfigs: LiftConfig[], sheetId: string, defs: WorkoutDefinition[]) => {
      setWorkouts(loadedWorkouts);
      setConfigs(loadedConfigs);
      setDefinitions(defs);
      setSpreadsheetId(sheetId);
      setSheetConnected(true);
      setNeedsSetup(false);
      // Fire-and-forget: load schedule and log data
      void loadScheduleData(sheetId);
      void loadLogData(sheetId);
    },
    [],
  );

  const handleNeedsSetup = useCallback((sheetId: string) => {
    setSpreadsheetId(sheetId);
    setSheetConnected(true);
    setNeedsSetup(true);
  }, []);

  const handleSetupConfirm = useCallback(
    async (configs: LiftConfig[]) => {
      if (!spreadsheetId) return;

      // Write the user's configs to the sheet (writeDefaultConfig writes
      // the header row too, which is needed for a fresh config zone).
      await writeDefaultConfig(spreadsheetId, configs);
      setConfigs(configs);

      // Read or write default workout definitions
      const liftNames = new Map(configs.map((c) => [c.id, c.name]));
      let defs = await readWorkoutDefs(spreadsheetId, liftNames);
      if (!defs) {
        await writeDefaultWorkoutDefs(spreadsheetId, workoutDefinitions);
        defs = workoutDefinitions;
      }
      setDefinitions(defs);

      const builtWorkouts = buildWorkoutsFromConfigs(configs, defs);
      setWorkouts(builtWorkouts);
      setNeedsSetup(false);

      // Fire-and-forget: load schedule and log data
      void loadScheduleData(spreadsheetId);
      void loadLogData(spreadsheetId);
    },
    [spreadsheetId],
  );

  const handleDisconnected = useCallback(() => {
    setSheetConnected(false);
    setActiveWorkout(null);
    setPreviousSets(null);
    setWorkouts([]);
    setConfigs([]);
    setDefinitions([]);
    setSpreadsheetId(null);
    setStartTime(null);
    setProgressionProposals(null);
    setSchedule([]);
    setLogRows([]);
    setNeedsSetup(false);
    replaceTo({ view: 'list' });
  }, [replaceTo]);

  const loadPreviousSets = useCallback(
    async (sheetId: string, workoutId: string) => {
      try {
        const logRows = await readLogZone(sheetId);
        const prev = findPreviousWorkoutSets(logRows, workoutId);
        setPreviousSets(prev);
      } catch {
        // Silently ignore — previous data is optional context
      }
    },
    [],
  );

  const handleSelectWorkout = useCallback((workout: Workout) => {
    if (workout.category === 'cardio') {
      setStartTime(new Date().toISOString());
      setActiveWorkout(workout);
      navigateTo({ view: 'cardio', workoutId: workout.id });
      return;
    }
    setStartTime(new Date().toISOString());
    setActiveWorkout(workout);
    setPreviousSets(null);
    navigateTo({ view: 'workout', workoutId: workout.id });
    // Fire-and-forget: load previous workout data for context
    if (spreadsheetId) {
      void loadPreviousSets(spreadsheetId, workout.id);
    }
  }, [spreadsheetId, loadPreviousSets, navigateTo]);

  const handleFinish = useCallback(
    (workout: Workout, results: SetResult[][]) => {
      const endTime = new Date().toISOString();
      if (spreadsheetId && startTime) {
        // Fire-and-forget: log results to the sheet, then reload log data
        void logWorkoutResults(
          spreadsheetId,
          workout,
          results,
          startTime,
          endTime,
        ).then(() => void loadLogData(spreadsheetId));
      }

      // Compute progression proposals for the completed workout
      const workoutDef = definitions.find((d) => d.id === workout.id);
      if (workoutDef && configs.length > 0) {
        const proposals = computeProgression(
          workout.exercises,
          results,
          configs,
          workoutDef.templates,
        );
        setProgressionProposals(proposals);
      }

      setActiveWorkout(null);
      setStartTime(null);
      setPreviousSets(null);
      navigateTo({ view: 'list' });
    },
    [spreadsheetId, startTime, configs, definitions, navigateTo],
  );

  const handleCardioFinish = useCallback(
    (workout: Workout, data: CardioLogData) => {
      const endTime = new Date().toISOString();
      if (spreadsheetId && startTime) {
        void logCardioResult(spreadsheetId, workout, data, startTime, endTime)
          .then(() => void loadLogData(spreadsheetId));
      }
      setActiveWorkout(null);
      setStartTime(null);
      navigateTo({ view: 'list' });
    },
    [spreadsheetId, startTime, navigateTo],
  );

  const handleProgressionConfirm = useCallback(
    (updates: Map<string, { topSetWeight: number; backoffWeight: number }>) => {
      // Apply updates to configs
      const updatedConfigs = configs.map((c) => {
        const update = updates.get(c.id);
        if (!update) return c;
        return { ...c, topSetWeight: update.topSetWeight, backoffWeight: update.backoffWeight };
      });

      // Write updated configs back to the sheet
      if (spreadsheetId) {
        void writeConfigValues(spreadsheetId, updatedConfigs);
      }

      // Update local state so the next workout uses the new weights
      setConfigs(updatedConfigs);
      setWorkouts(buildWorkoutsFromConfigs(updatedConfigs, definitions));
      setProgressionProposals(null);
    },
    [spreadsheetId, configs, definitions],
  );

  const handleProgressionSkip = useCallback(() => {
    setProgressionProposals(null);
  }, []);

  const handleBack = useCallback(() => {
    setActiveWorkout(null);
    setStartTime(null);
    setPreviousSets(null);
    navigateTo({ view: 'list' });
  }, [navigateTo]);

  // Schedule handlers
  const loadScheduleData = useCallback(async (sheetId: string) => {
    try {
      const tabExists = await verifyScheduleTab(sheetId);
      if (!tabExists) {
        await createScheduleTab(sheetId);
      }
      const entries = await readSchedule(sheetId);
      setSchedule(entries);
    } catch {
      // Silently ignore — schedule data is optional
    }
  }, []);

  const loadLogData = useCallback(async (sheetId: string) => {
    try {
      const rows = await readLogZone(sheetId);
      setLogRows(rows);
    } catch {
      // Silently ignore — log data is optional for calendar history
    }
  }, []);

  const handleScheduleAssign = useCallback(
    (date: string, workoutId: string) => {
      const updated = [...schedule, { date, workoutId }];
      setSchedule(updated);
      if (spreadsheetId) {
        void writeSchedule(spreadsheetId, updated);
      }
    },
    [schedule, spreadsheetId],
  );

  const handleBulkSchedule = useCallback(
    (entries: ScheduleEntry[]) => {
      // Merge: remove existing entries for dates covered by the new plan, then add new ones
      const newDates = new Set(entries.map((e) => e.date));
      const kept = schedule.filter((e) => !newDates.has(e.date));
      const updated = [...kept, ...entries];
      setSchedule(updated);
      if (spreadsheetId) {
        void writeSchedule(spreadsheetId, updated);
      }
    },
    [schedule, spreadsheetId],
  );

  const handleScheduleRemove = useCallback(
    (date: string, workoutId: string) => {
      // Remove the first matching entry for this date+workoutId
      let removed = false;
      const updated = schedule.filter((e) => {
        if (!removed && e.date === date && e.workoutId === workoutId) {
          removed = true;
          return false;
        }
        return true;
      });
      setSchedule(updated);
      if (spreadsheetId) {
        void writeSchedule(spreadsheetId, updated);
      }
    },
    [schedule, spreadsheetId],
  );

  const handleCalendarOpenWorkout = useCallback(
    (workoutId: string) => {
      const match = workouts.find((w) => w.id === workoutId);
      if (match) {
        handleSelectWorkout(match);
      }
    },
    [workouts, handleSelectWorkout],
  );

  const handleUpdateLogRows = useCallback(
    (sessionDate: string, sessionWorkoutId: string, sessionStartTime: string, updatedRows: ParsedLogRow[]) => {
      // Update local state
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
          if (idx >= 0) {
            next[idx] = updated;
          }
        }
        return next;
      });
      // Fire-and-forget: write to sheet
      if (spreadsheetId) {
        void updateLogRows(spreadsheetId, sessionDate, sessionWorkoutId, sessionStartTime, updatedRows);
      }
    },
    [spreadsheetId],
  );

  const handleDeleteSession = useCallback(
    (sessionDate: string, sessionWorkoutId: string, sessionStartTime: string) => {
      // Remove matching rows from local state
      setLogRows((prev) =>
        prev.filter(
          (r) =>
            !(r.date === sessionDate && r.workoutId === sessionWorkoutId && r.startTime === sessionStartTime),
        ),
      );
      // Fire-and-forget: delete from sheet
      if (spreadsheetId) {
        void deleteLogSession(spreadsheetId, sessionDate, sessionWorkoutId, sessionStartTime);
      }
    },
    [spreadsheetId],
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

  const handleGoToList = useCallback(() => {
    navigateTo({ view: 'list' });
  }, [navigateTo]);

  const handleOpenCalendar = useCallback(() => {
    navigateTo({ view: 'calendar' });
  }, [navigateTo]);

  const handleOpenExercises = useCallback(() => {
    navigateTo({ view: 'exercises' });
  }, [navigateTo]);

  const handleOpenProgress = useCallback(() => {
    navigateTo({ view: 'progress' });
  }, [navigateTo]);

  const handleOpenSettings = useCallback(() => {
    navigateTo({ view: 'settings' });
  }, [navigateTo]);

  const handleImportComplete = useCallback((_rowCount: number) => {
    // Refresh log data so progress charts and calendar history reflect the import
    if (spreadsheetId) {
      void loadLogData(spreadsheetId);
    }
  }, [spreadsheetId]);

  // Editor handlers
  const handleEditWorkout = useCallback((workoutId: string) => {
    navigateTo({ view: 'editor', workoutId });
  }, [navigateTo]);

  const handleNewWorkout = useCallback(() => {
    navigateTo({ view: 'editor' });
  }, [navigateTo]);

  const handleToggleFavorite = useCallback(
    (workoutId: string, favorite: boolean) => {
      const updatedDefs = definitions.map((d) =>
        d.id === workoutId ? { ...d, favorite } : d,
      );
      setDefinitions(updatedDefs);
      setWorkouts(buildWorkoutsFromConfigs(configs, updatedDefs));
      if (spreadsheetId) {
        void writeWorkoutDefs(spreadsheetId, updatedDefs);
      }
    },
    [definitions, configs, spreadsheetId],
  );

  const handleEditorCancel = useCallback(() => {
    navigateTo({ view: 'list' });
  }, [navigateTo]);

  // Exercise editor handlers
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

      if (spreadsheetId) {
        void writeConfigValues(spreadsheetId, updatedConfigs);
      }

      navigateTo({ view: 'exercises' });
    },
    [configs, definitions, spreadsheetId, navigateTo],
  );

  const handleEditorSave = useCallback(
    (definition: WorkoutDefinition) => {
      const isNew = !definitions.some((d) => d.id === definition.id);
      const updatedDefs = isNew
        ? [...definitions, definition]
        : definitions.map((d) => (d.id === definition.id ? definition : d));

      setDefinitions(updatedDefs);
      setWorkouts(buildWorkoutsFromConfigs(configs, updatedDefs));

      if (spreadsheetId) {
        void writeWorkoutDefs(spreadsheetId, updatedDefs);
      }

      navigateTo({ view: 'list' });
    },
    [definitions, configs, spreadsheetId, navigateTo],
  );

  // Deep-link resolution: when auth completes and workouts are loaded,
  // check if the URL contains a workout ID and auto-select it.
  // Sets state directly instead of calling handleSelectWorkout to avoid
  // a redundant navigateTo → hashchange → setRoute cycle that causes
  // extra renders and can make the app appear hung.
  useEffect(() => {
    if (!sheetConnected || workouts.length === 0) return;
    if (route.view !== 'workout' && route.view !== 'cardio') return;
    // Already showing the right workout — nothing to do
    if (activeWorkout?.id === route.workoutId) return;

    const match = workouts.find((w) => w.id === route.workoutId);
    if (match) {
      setStartTime(new Date().toISOString());
      setActiveWorkout(match);
      // For strength workouts, load previous session data
      if (match.category !== 'cardio') {
        setPreviousSets(null);
        if (spreadsheetId) {
          void loadPreviousSets(spreadsheetId, match.id);
        }
      }
      // Fix the URL if the route view doesn't match the workout category
      // (e.g. #/workout/running for a cardio workout → #/cardio/running)
      const expectedView = match.category === 'cardio' ? 'cardio' : 'workout';
      if (route.view !== expectedView) {
        replaceTo({ view: expectedView, workoutId: match.id } as { view: 'workout' | 'cardio'; workoutId: string });
      }
    } else {
      // Invalid workout ID — redirect to list
      replaceTo({ view: 'list' });
    }
  }, [sheetConnected, workouts, route, activeWorkout?.id, spreadsheetId, loadPreviousSets, replaceTo]);

  // Sync state when the user presses the browser back button:
  // if the URL changed to list while a workout is active, clear it.
  useEffect(() => {
    if (route.view === 'list' && activeWorkout && !progressionProposals) {
      setActiveWorkout(null);
      setStartTime(null);
      setPreviousSets(null);
    }
  }, [route, activeWorkout, progressionProposals]);

  // Gate: require auth + sheet connection before showing workouts
  if (!sheetConnected) {
    return (
      <GoogleAuth
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onNeedsSetup={handleNeedsSetup}
      />
    );
  }

  // Show setup page for first-time users (empty config zone)
  if (needsSetup) {
    return (
      <SetupPage
        onConfirm={handleSetupConfirm}
      />
    );
  }

  // Show progression review after finishing a workout
  if (progressionProposals) {
    return (
      <ProgressionReview
        proposals={progressionProposals}
        onConfirm={handleProgressionConfirm}
        onSkip={handleProgressionSkip}
      />
    );
  }

  if (activeWorkout) {
    if (activeWorkout.category === 'cardio') {
      return (
        <CardioView
          workout={activeWorkout}
          onBack={handleBack}
          onFinish={handleCardioFinish}
        />
      );
    }
    return (
      <WorkoutView
        workout={activeWorkout}
        previousSets={previousSets}
        onBack={handleBack}
        onFinish={handleFinish}
      />
    );
  }

  if (route.view === 'exerciseEditor') {
    const editConfig = route.exerciseId
      ? configs.find((c) => c.id === route.exerciseId)
      : undefined;
    return (
      <>
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenSettings={handleOpenSettings}
        />
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
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenSettings={handleOpenSettings}
        />
        <ExerciseLibrary
          configs={configs}
          onEdit={handleEditExercise}
          onNew={handleNewExercise}
        />
      </>
    );
  }

  if (route.view === 'editor') {
    const editDef = route.workoutId
      ? definitions.find((d) => d.id === route.workoutId)
      : undefined;
    return (
      <>
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenSettings={handleOpenSettings}
        />
        <WorkoutEditor
          existing={editDef}
          allDefinitions={definitions}
          configs={configs}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      </>
    );
  }

  if (route.view === 'calendar') {
    return (
      <>
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenSettings={handleOpenSettings}
        />
        <CalendarView
          workouts={workouts}
          schedule={schedule}
          logRows={logRows}
          onAssign={handleScheduleAssign}
          onRemove={handleScheduleRemove}
          onOpenWorkout={handleCalendarOpenWorkout}
          onUpdateLogRows={handleUpdateLogRows}
          onDeleteSession={handleDeleteSession}
          onBulkSchedule={handleBulkSchedule}
        />
      </>
    );
  }

  if (route.view === 'progress') {
    return (
      <>
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenSettings={handleOpenSettings}
        />
        <ProgressView logRows={logRows} />
      </>
    );
  }

  if (route.view === 'settings' && spreadsheetId) {
    return (
      <>
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenSettings={handleOpenSettings}
        />
        <SettingsView
          spreadsheetId={spreadsheetId}
          onImportComplete={handleImportComplete}
          appendLogRows={appendLogRows}
        />
      </>
    );
  }

  // Compute missing liftIds: referenced in definitions but absent from configs
  const configIds = new Set(configs.map((c) => c.id));
  const missingLiftIds = [...new Set(
    definitions.flatMap((d) => d.templates.map((t) => t.liftId))
  )].filter((id) => !configIds.has(id));

  // Build workout names map for SessionDetail
  const workoutNames = new Map<string, string>(workouts.map((w) => [w.id, w.name]));

  if (viewingSession) {
    return (
      <>
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenSettings={handleOpenSettings}
        />
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
      <GoogleAuth
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onGoToList={handleGoToList}
        onOpenCalendar={handleOpenCalendar}
        onOpenExercises={handleOpenExercises}
        onOpenProgress={handleOpenProgress}
        onOpenSettings={handleOpenSettings}
      />
      <WorkoutSelect
        workouts={workouts}
        missingLiftIds={missingLiftIds}
        schedule={schedule}
        logRows={logRows}
        onSelect={handleSelectWorkout}
        onViewSession={handleViewSession}
        onEdit={handleEditWorkout}
        onNew={handleNewWorkout}
        onToggleFavorite={handleToggleFavorite}
      />
    </>
  );
}

export default App;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function logWorkoutResults(
  sheetId: string,
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
        buildLogRow(
          ctx,
          exercise.name,
          exercise.liftId,
          si + 1,
          results[ei][si].actualSetType,
          planned,
          results[ei][si],
        ),
      );
    }
  }

  await appendLogRows(sheetId, rows);
}

async function logCardioResult(
  sheetId: string,
  workout: Workout,
  data: CardioLogData,
  startTime: string,
  endTime: string,
): Promise<void> {
  const now = new Date(endTime);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const ctx = { date, startTime, endTime, workoutId: workout.id };
  const row = buildCardioLogRow(ctx, workout.name, data);
  await appendLogRows(sheetId, [row]);
}
