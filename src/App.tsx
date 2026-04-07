import { useState, useCallback, useEffect, useRef } from 'react';
import type { Workout, LiftConfig, SetResult, ComputedSet, PreviousSetData, ProgressionProposal, ScheduleEntry, DayFlags, CardioActivity, AppSettings } from './model/index.js';
import { computeProgression } from './model/index.js';
import { appendLogRows, buildLogRow, readLogZone, findPreviousWorkoutSets, writeConfigValues, writeDefaultConfig, verifyScheduleTab, createScheduleTab, readSchedule, writeSchedule, writeWorkoutDefs, readWorkoutDefs, writeDefaultWorkoutDefs, updateLogRows, deleteLogSession, writeCardioActivities, readCardioActivities, writeDefaultCardioActivities, readGarminActivities, verifyGarminTab, createGarminTab, verifySettingsTab, createSettingsTab, readSettings, writeSettings, goalsFromSettings, goalsToSettings, DEFAULT_APP_SETTINGS, appSettingsFromMap, appSettingsToMap } from './google/index.js';
import { syncScheduleWithCalendar } from './google/index.js';
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
import { GarminView } from './components/GarminView.js';
import { SettingsView } from './components/SettingsView.js';
import { SetupPage } from './components/SetupPage.js';
import { GoogleAuth } from './components/GoogleAuth.js';
import { useHashRouter } from './hooks/useHashRouter.js';
import { loadDraft, saveDraft, clearDraft } from './hooks/useWorkoutDraft.js';
import type { GarminActivity, GarminGoal, GarminMetric } from './model/garmin.js';
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
  const [cardioActivities, setCardioActivities] = useState<CardioActivity[]>([]);
  const [garminActivities, setGarminActivities] = useState<GarminActivity[]>([]);
  const [garminGoals, setGarminGoals] = useState<GarminGoal[]>([]);
  const [draftResults, setDraftResults] = useState<SetResult[][] | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const settingsRef = useRef(new Map<string, string>());

  const handleConnected = useCallback(
    (loadedWorkouts: Workout[], loadedConfigs: LiftConfig[], sheetId: string, defs: WorkoutDefinition[], cardio: CardioActivity[]) => {
      setWorkouts(loadedWorkouts);
      setConfigs(loadedConfigs);
      setDefinitions(defs);
      setSpreadsheetId(sheetId);
      setSheetConnected(true);
      setNeedsSetup(false);
      setCardioActivities(cardio);
      // Fire-and-forget: load schedule and log data
      void loadScheduleData(sheetId);
      void loadLogData(sheetId);
      void loadGarminData(sheetId);
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

      // Read or seed default cardio activities
      let cardio = await readCardioActivities(spreadsheetId);
      if (!cardio) {
        await writeDefaultCardioActivities(spreadsheetId, defaultCardioActivities);
        cardio = [...defaultCardioActivities];
      }
      setCardioActivities(cardio);

      const builtWorkouts = buildWorkoutsFromConfigs(configs, defs);
      setWorkouts(builtWorkouts);
      setNeedsSetup(false);

      // Fire-and-forget: load schedule and log data
      void loadScheduleData(spreadsheetId);
      void loadLogData(spreadsheetId);
      void loadGarminData(spreadsheetId);
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
    setCardioActivities([]);
    setGarminActivities([]);
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
    const now = new Date().toISOString();
    setStartTime(now);
    setActiveWorkout(workout);
    setPreviousSets(null);
    setDraftResults(null);
    // Persist the draft so a refresh can restore the active workout
    saveDraft({ workoutId: workout.id, startTime: now, results: [] });
    navigateTo({ view: 'workout', workoutId: workout.id });
    // Fire-and-forget: load previous workout data for context
    if (spreadsheetId) {
      void loadPreviousSets(spreadsheetId, workout.id);
    }
  }, [spreadsheetId, loadPreviousSets, navigateTo]);

  const handleFinish = useCallback(
    (workout: Workout, results: SetResult[][]) => {
      const endTime = new Date().toISOString();
      // Clear the in-progress draft now that the workout is complete
      clearDraft();
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
    clearDraft();
    setActiveWorkout(null);
    setStartTime(null);
    setPreviousSets(null);
    setDraftResults(null);
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

  const loadGarminData = useCallback(async (sheetId: string) => {
    try {
      const tabExists = await verifyGarminTab(sheetId);
      if (!tabExists) {
        await createGarminTab(sheetId);
      }
      const activities = await readGarminActivities(sheetId);
      setGarminActivities(activities);
    } catch {
      // Silently ignore — Garmin data is optional
    }
    try {
      const settingsTabExists = await verifySettingsTab(sheetId);
      if (!settingsTabExists) {
        await createSettingsTab(sheetId);
      }
      const settings = await readSettings(sheetId);
      settingsRef.current = settings;
      setGarminGoals(goalsFromSettings(settings));
      setAppSettings(appSettingsFromMap(settings));
    } catch {
      // Silently ignore — settings data is optional
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
      // Separate clear signals from actual additions
      const datesToClear = new Set(
        entries.filter((e) => e.workoutId === '__clear__').map((e) => e.date),
      );
      const toAdd = entries.filter((e) => e.workoutId !== '__clear__');

      // Remove workouts from cleared dates (preserve flag-only rows)
      let updated = schedule.filter((e) => {
        if (!datesToClear.has(e.date)) return true;
        return e.workoutId === '';
      });

      // Add new entries, deduplicating (skip if same date+workoutId already exists)
      for (const entry of toAdd) {
        const exists = updated.some(
          (e) => e.date === entry.date && e.workoutId === entry.workoutId,
        );
        if (!exists) {
          updated.push(entry);
        }
      }

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

  const handleUpdateFlags = useCallback(
    (date: string, flags: DayFlags) => {
      const hasFlags = flags.home || flags.elsewhere || flags.travel || flags.visitors || flags.blocked;
      // Find the first entry for this date to apply flags to
      const firstIdx = schedule.findIndex((e) => e.date === date);
      let updated: ScheduleEntry[];
      if (firstIdx >= 0) {
        // Update flags on the first entry for this date
        updated = schedule.map((e, i) =>
          i === firstIdx ? { ...e, flags: hasFlags ? flags : undefined } : e,
        );
      } else if (hasFlags) {
        // No existing entry — add a flag-only row
        updated = [...schedule, { date, workoutId: '', flags }];
      } else {
        return; // No flags and no existing entry — nothing to do
      }
      // Remove flag-only rows that no longer have flags
      updated = updated.filter((e) => e.workoutId || (e.flags && (e.flags.home || e.flags.elsewhere || e.flags.travel || e.flags.visitors || e.flags.blocked)));
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

  const handleSyncCalendar = useCallback(
    async (calendarId: string): Promise<CalendarSyncResult> => {
      const resolveWorkoutName = (workoutId: string): string | null => {
        if (workoutId.startsWith('cardio:')) {
          const cardioId = workoutId.slice('cardio:'.length);
          const c = cardioActivities.find((a) => a.id === cardioId);
          return c?.name ?? null;
        }
        const w = workouts.find((wk) => wk.id === workoutId);
        return w?.name ?? null;
      };

      const { updatedSchedule, result } = await syncScheduleWithCalendar(
        calendarId,
        schedule,
        resolveWorkoutName,
      );

      setSchedule(updatedSchedule);
      if (spreadsheetId) {
        void writeSchedule(spreadsheetId, updatedSchedule);
      }
      return result;
    },
    [schedule, workouts, cardioActivities, spreadsheetId],
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

  const handleOpenGarmin = useCallback(() => {
    navigateTo({ view: 'garmin' });
  }, [navigateTo]);

  const handleGarminGoalChange = useCallback((metric: GarminMetric, value: number | null) => {
    setGarminGoals((prev) => {
      const updated = prev.filter((g) => g.metric !== metric);
      if (value !== null) {
        updated.push({ metric, value });
      }
      if (spreadsheetId) {
        // Merge goals into settings and write the full settings map
        goalsToSettings(updated, settingsRef.current);
        void writeSettings(spreadsheetId, settingsRef.current).catch(() => {});
      }
      return updated;
    });
  }, [spreadsheetId]);

  const handleAppSettingChange = useCallback((key: keyof AppSettings, value: boolean) => {
    setAppSettings((prev) => {
      const updated = { ...prev, [key]: value };
      if (spreadsheetId) {
        appSettingsToMap(updated, settingsRef.current);
        void writeSettings(spreadsheetId, settingsRef.current).catch(() => {});
      }
      return updated;
    });
  }, [spreadsheetId]);

  const handleImportComplete = useCallback(() => {
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

  const handleCardioSave = useCallback(
    (updated: CardioActivity[]) => {
      setCardioActivities(updated);
      if (spreadsheetId) {
        void writeCardioActivities(spreadsheetId, updated);
      }
    },
    [spreadsheetId],
  );

  const handleEditorCancel = useCallback(() => {
    navigateTo({ view: 'list' });
  }, [navigateTo]);

  const handleDeleteWorkout = useCallback(
    (workoutId: string) => {
      const updatedDefs = definitions.filter((d) => d.id !== workoutId);
      setDefinitions(updatedDefs);
      setWorkouts(buildWorkoutsFromConfigs(configs, updatedDefs));
      if (spreadsheetId) {
        void writeWorkoutDefs(spreadsheetId, updatedDefs);
      }
      navigateTo({ view: 'list' });
    },
    [definitions, configs, spreadsheetId, navigateTo],
  );

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
  // If a draft exists in localStorage for this workout, restore startTime
  // and set results so the user doesn't lose progress after a refresh.
  useEffect(() => {
    if (!sheetConnected || workouts.length === 0) return;
    if (route.view !== 'workout') return;
    // Already showing the right workout — nothing to do
    if (activeWorkout?.id === route.workoutId) return;

    const match = workouts.find((w) => w.id === route.workoutId);
    if (match) {
      // Check for a saved draft from a previous session (page refresh)
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
      if (spreadsheetId) {
        void loadPreviousSets(spreadsheetId, match.id);
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
      clearDraft();
      setActiveWorkout(null);
      setStartTime(null);
      setPreviousSets(null);
      setDraftResults(null);
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

  const onOpenGarmin = garminActivities.length > 0 ? handleOpenGarmin : undefined;

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
    return (
      <WorkoutView
        workout={activeWorkout}
        previousSets={previousSets}
        startTime={startTime ?? new Date().toISOString()}
        draftResults={draftResults}
        appSettings={appSettings}
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
          onOpenGarmin={onOpenGarmin}
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
          onOpenGarmin={onOpenGarmin}
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
          onOpenGarmin={onOpenGarmin}
          onOpenSettings={handleOpenSettings}
        />
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
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenGarmin={onOpenGarmin}
          onOpenSettings={handleOpenSettings}
        />
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
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenGarmin={onOpenGarmin}
          onOpenSettings={handleOpenSettings}
        />
        <ProgressView logRows={logRows} />
      </>
    );
  }

  if (route.view === 'garmin') {
    return (
      <>
        <GoogleAuth
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onGoToList={handleGoToList}
          onOpenCalendar={handleOpenCalendar}
          onOpenExercises={handleOpenExercises}
          onOpenProgress={handleOpenProgress}
          onOpenGarmin={onOpenGarmin}
          onOpenSettings={handleOpenSettings}
        />
        <GarminView
          activities={garminActivities}
          goals={garminGoals}
          onGoalChange={handleGarminGoalChange}
        />
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
          onOpenGarmin={onOpenGarmin}
          onOpenSettings={handleOpenSettings}
        />
        <SettingsView
          spreadsheetId={spreadsheetId}
          onImportComplete={handleImportComplete}
          appendLogRows={appendLogRows}
          onDisconnectSheet={handleDisconnected}
          appSettings={appSettings}
          onAppSettingChange={handleAppSettingChange}
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
          onOpenGarmin={onOpenGarmin}
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
        onOpenGarmin={onOpenGarmin}
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

