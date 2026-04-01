import { useState, useCallback } from 'react';
import type { Workout } from './model/index.js';
import { sampleWorkouts } from './data/sample-workouts.js';
import { WorkoutSelect } from './components/WorkoutSelect.js';
import { WorkoutView } from './components/WorkoutView.js';
import { GoogleAuth } from './components/GoogleAuth.js';
import './App.css';

function App() {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [sheetConnected, setSheetConnected] = useState(false);

  const handleConnected = useCallback(() => {
    setSheetConnected(true);
  }, []);

  // Gate: require auth + sheet connection before showing workouts
  if (!sheetConnected) {
    return <GoogleAuth onConnected={handleConnected} />;
  }

  if (activeWorkout) {
    return (
      <WorkoutView
        workout={activeWorkout}
        onBack={() => setActiveWorkout(null)}
      />
    );
  }

  return (
    <>
      <GoogleAuth onConnected={handleConnected} />
      <WorkoutSelect
        workouts={sampleWorkouts}
        onSelect={setActiveWorkout}
      />
    </>
  );
}

export default App
