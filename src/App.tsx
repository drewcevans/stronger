import { useState } from 'react';
import type { Workout } from './model/index.js';
import { sampleWorkouts } from './data/sample-workouts.js';
import { WorkoutSelect } from './components/WorkoutSelect.js';
import { WorkoutView } from './components/WorkoutView.js';
import './App.css';

function App() {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);

  if (activeWorkout) {
    return (
      <WorkoutView
        workout={activeWorkout}
        onBack={() => setActiveWorkout(null)}
      />
    );
  }

  return (
    <WorkoutSelect
      workouts={sampleWorkouts}
      onSelect={setActiveWorkout}
    />
  );
}

export default App
