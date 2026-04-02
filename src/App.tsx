import { useState, useCallback } from 'react';
import type { Workout, LiftConfig, SetResult, ComputedSet, PreviousSetData, ProgressionProposal } from './model/index.js';
import { computeProgression } from './model/index.js';
import { appendLogRows, buildLogRow, readLogZone, findPreviousWorkoutSets, writeConfigValues } from './google/index.js';
import type { WorkoutDefinition } from './data/sample-workouts.js';
import { buildWorkoutsFromConfigs } from './data/sample-workouts.js';
import { WorkoutSelect } from './components/WorkoutSelect.js';
import { WorkoutView } from './components/WorkoutView.js';
import { ProgressionReview } from './components/ProgressionReview.js';
import { GoogleAuth } from './components/GoogleAuth.js';
import './App.css';

function App() {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [previousSets, setPreviousSets] = useState<PreviousSetData[][] | null>(null);
  const [sheetConnected, setSheetConnected] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<LiftConfig[]>([]);
  const [definitions, setDefinitions] = useState<WorkoutDefinition[]>([]);
  const [progressionProposals, setProgressionProposals] = useState<ProgressionProposal[] | null>(null);

  const handleConnected = useCallback(
    (loadedWorkouts: Workout[], loadedConfigs: LiftConfig[], sheetId: string, defs: WorkoutDefinition[]) => {
      setWorkouts(loadedWorkouts);
      setConfigs(loadedConfigs);
      setDefinitions(defs);
      setSpreadsheetId(sheetId);
      setSheetConnected(true);
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
  }, []);

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
    setStartTime(new Date().toISOString());
    setActiveWorkout(workout);
    setPreviousSets(null);
    // Fire-and-forget: load previous workout data for context
    if (spreadsheetId) {
      void loadPreviousSets(spreadsheetId, workout.id);
    }
  }, [spreadsheetId, loadPreviousSets]);

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
    },
    [spreadsheetId, startTime, configs, definitions],
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
        onBack={() => {
          setActiveWorkout(null);
          setStartTime(null);
          setPreviousSets(null);
        }}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <>
      <GoogleAuth
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
      />
      <WorkoutSelect workouts={workouts} onSelect={handleSelectWorkout} />
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
