import { useState, useCallback, useEffect } from 'react';
import type { Workout, LiftConfig, SetResult, ComputedSet, PreviousSetData, ProgressionProposal, ScheduleEntry } from './model/index.js';
import { computeProgression } from './model/index.js';
import { appendLogRows, buildLogRow, readLogZone, findPreviousWorkoutSets, writeConfigValues, verifyScheduleTab, createScheduleTab, readSchedule, writeSchedule } from './google/index.js';
import type { WorkoutDefinition } from './data/sample-workouts.js';
import { buildWorkoutsFromConfigs } from './data/sample-workouts.js';
import { WorkoutSelect } from './components/WorkoutSelect.js';
import { WorkoutView } from './components/WorkoutView.js';
import { ProgressionReview } from './components/ProgressionReview.js';
import { CalendarView } from './components/CalendarView.js';
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

  const handleConnected = useCallback(
    (loadedWorkouts: Workout[], loadedConfigs: LiftConfig[], sheetId: string, defs: WorkoutDefinition[]) => {
      setWorkouts(loadedWorkouts);
      setConfigs(loadedConfigs);
      setDefinitions(defs);
      setSpreadsheetId(sheetId);
      setSheetConnected(true);
      // Fire-and-forget: load schedule data
      void loadScheduleData(sheetId);
    },
    [],
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
    // Cardio items don't have a workout execution view
    if (workout.category === 'cardio') return;
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
        // Fire-and-forget: log results to the sheet
        void logWorkoutResults(
          spreadsheetId,
          workout,
          results,
          startTime,
          endTime,
        );
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
      // Only open the workout execution view for strength workouts
      if (match && match.category !== 'cardio') {
        handleSelectWorkout(match);
      }
    },
    [workouts, handleSelectWorkout],
  );

  const handleGoToList = useCallback(() => {
    navigateTo({ view: 'list' });
  }, [navigateTo]);

  const handleOpenCalendar = useCallback(() => {
    navigateTo({ view: 'calendar' });
  }, [navigateTo]);

  // Deep-link resolution: when auth completes and workouts are loaded,
  // check if the URL contains a workout ID and auto-select it.
  useEffect(() => {
    if (!sheetConnected || workouts.length === 0) return;
    if (route.view !== 'workout') return;
    // Already showing the right workout — nothing to do
    if (activeWorkout?.id === route.workoutId) return;

    const match = workouts.find((w) => w.id === route.workoutId);
    if (match) {
      handleSelectWorkout(match);
    } else {
      // Invalid workout ID — redirect to list
      replaceTo({ view: 'list' });
    }
  }, [sheetConnected, workouts, route, activeWorkout?.id, handleSelectWorkout, replaceTo]);

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
    return (
      <WorkoutView
        workout={activeWorkout}
        previousSets={previousSets}
        onBack={handleBack}
        onFinish={handleFinish}
      />
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
        />
        <CalendarView
          workouts={workouts}
          schedule={schedule}
          onAssign={handleScheduleAssign}
          onRemove={handleScheduleRemove}
          onOpenWorkout={handleCalendarOpenWorkout}
        />
      </>
    );
  }

  // Compute missing liftIds: referenced in definitions but absent from configs
  const configIds = new Set(configs.map((c) => c.id));
  const missingLiftIds = [...new Set(
    definitions.flatMap((d) => d.templates.map((t) => t.liftId))
  )].filter((id) => !configIds.has(id));

  return (
    <>
      <GoogleAuth
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onGoToList={handleGoToList}
        onOpenCalendar={handleOpenCalendar}
      />
      <WorkoutSelect workouts={workouts} missingLiftIds={missingLiftIds} onSelect={handleSelectWorkout} />
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
