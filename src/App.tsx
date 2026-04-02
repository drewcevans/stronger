import { useState, useCallback } from 'react';
import type { Workout, LiftConfig, SetResult } from './model/index.js';
import { appendLogRows, buildLogRow } from './google/index.js';
import { WorkoutSelect } from './components/WorkoutSelect.js';
import { WorkoutView } from './components/WorkoutView.js';
import { GoogleAuth } from './components/GoogleAuth.js';
import './App.css';

function App() {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [sheetConnected, setSheetConnected] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  const handleConnected = useCallback(
    (loadedWorkouts: Workout[], _configs: LiftConfig[], sheetId: string) => {
      setWorkouts(loadedWorkouts);
      setSpreadsheetId(sheetId);
      setSheetConnected(true);
    },
    [],
  );

  const handleDisconnected = useCallback(() => {
    setSheetConnected(false);
    setActiveWorkout(null);
    setWorkouts([]);
    setSpreadsheetId(null);
    setStartTime(null);
  }, []);

  const handleSelectWorkout = useCallback((workout: Workout) => {
    setStartTime(new Date().toISOString());
    setActiveWorkout(workout);
  }, []);

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
      setActiveWorkout(null);
      setStartTime(null);
    },
    [spreadsheetId, startTime],
  );

  // Gate: require auth + sheet connection before showing workouts
  if (!sheetConnected) {
    return (
      <GoogleAuth
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
      />
    );
  }

  if (activeWorkout) {
    return (
      <WorkoutView
        workout={activeWorkout}
        onBack={() => {
          setActiveWorkout(null);
          setStartTime(null);
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
    for (let si = 0; si < exercise.sets.length; si++) {
      rows.push(
        buildLogRow(
          ctx,
          exercise.name,
          exercise.liftId,
          si + 1,
          results[ei][si].actualSetType,
          exercise.sets[si],
          results[ei][si],
        ),
      );
    }
  }

  await appendLogRows(sheetId, rows);
}
