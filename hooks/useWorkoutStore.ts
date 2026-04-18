import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ── Types ──────────────────────────────────────────────

export interface PlanExercise {
  id: string;
  name: string;
  sets: number;   // 0 = non-trackable (rest day items)
  reps: string;   // target reps e.g. "4–6"
  note: string;
}

export interface PlanDay {
  day: string;
  label: string;
  tag: string;
  color: string;
  focus: string;
  exercises: PlanExercise[];
}

export interface SetData {
  weight: string;
  reps: string;
  completed: boolean;
}

interface ExerciseData {
  sets: SetData[];
}

interface RecordedDay {
  exercises: Record<string, ExerciseData>; // exerciseId → ExerciseData
}

interface RecordedWeek {
  days: Record<number, RecordedDay>;
}

interface WorkoutState {
  activeDay: number;
  customPlan: PlanDay[];
  workoutHistory: Record<string, RecordedWeek>;
  stepsCount: number;
  lastCheckWeek: string;
  unit: 'kg' | 'lbs';
  manualWalkCompleted: boolean;
  exerciseWeights: Record<string, string>; // legacy, kept for compat

  // Nav
  setActiveDay: (day: number) => void;

  // Plan editing
  renameExercise: (dayIndex: number, exerciseId: string, newName: string) => void;
  addExercise: (dayIndex: number, name: string, sets: number, reps: string, note: string) => void;
  deleteExercise: (dayIndex: number, exerciseId: string) => void;
  updateExerciseSetCount: (dayIndex: number, exerciseId: string, newCount: number) => void;

  // Per-set tracking
  updateSetData: (weekKey: string, dayIndex: number, exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: string) => void;
  toggleSetCompleted: (weekKey: string, dayIndex: number, exerciseId: string, setIndex: number) => void;
  getExerciseSets: (weekKey: string, dayIndex: number, exerciseId: string, setCount: number) => SetData[];
  syncExerciseSets: (weekKey: string, dayIndex: number, exerciseId: string, setCount: number) => void;

  // Misc
  updateSteps: (steps: number) => void;
  checkReset: () => void;
  toggleUnit: () => void;
  toggleManualWalk: () => void;
}

// ── Helpers ──────────────────────────────────────────────

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const getTodayIndex = () => {
  const day = new Date().getDay();
  return (day + 6) % 7; // Mon: 0 … Sun: 6
};

const getWeekKey = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
};

// ── Default Plan ──────────────────────────────────────────────

const makeEx = (name: string, sets: number, reps: string, note: string): PlanExercise => ({
  id: genId() + '_' + name.slice(0, 4).toLowerCase(),
  name, sets, reps, note,
});

const DEFAULT_PLAN: PlanDay[] = [
  {
    day: 'Day 1', label: 'Push — Chest Heavy', tag: 'PUSH', color: '#FF6B35',
    focus: 'Chest is your strength — keep it heavy, efficient',
    exercises: [
      makeEx('Flat Barbell Bench Press', 5, '4–6', 'Heavy — this is your strength day'),
      makeEx('Incline Dumbbell Press', 4, '8–10', 'Upper chest shape'),
      makeEx('Pec Deck / Cable Fly', 3, '12–15', 'Inner chest definition, squeeze hard'),
      makeEx('Tricep Pushdown (rope)', 4, '12–15', 'Keep elbows pinned'),
      makeEx('Overhead Tricep Extension', 3, '12–15', 'Long head — makes arms look bigger'),
      makeEx('Skull Crushers (EZ bar)', 3, '10–12', 'Tri mass builder'),
    ],
  },
  {
    day: 'Day 2', label: 'Pull — Back Heavy', tag: 'PULL', color: '#4ECDC4',
    focus: 'Back is your strength — go heavy, build thickness',
    exercises: [
      makeEx('Deadlift or T-Bar Row', 5, '4–6', 'Your main heavy movement'),
      makeEx('Weighted Pull-Ups / Lat Pulldown', 4, '6–8', 'V-taper — go heavy'),
      makeEx('Barbell Row', 4, '6–8', 'Mid back thickness'),
      makeEx('Seated Cable Row', 3, '10–12', 'Full stretch and squeeze'),
      makeEx('Barbell Curl', 4, '8–10', 'Bicep peak — strict form only'),
      makeEx('Incline Dumbbell Curl', 3, '10–12', 'Long head stretch = more peak'),
      makeEx('Hammer Curl', 3, '12', 'Brachialis — makes arms look thick'),
    ],
  },
  {
    day: 'Day 3', label: 'Legs — Quads & Core', tag: 'LEGS', color: '#A855F7',
    focus: 'Quads + heavy core work to attack side fat',
    exercises: [
      makeEx('Barbell Back Squat', 4, '5–7', 'Heavy compound — no skipping'),
      makeEx('Leg Press', 3, '10–12', 'Quad + glute drive'),
      makeEx('Bulgarian Split Squat', 3, '10 each', 'Fixes imbalances'),
      makeEx('Leg Extension', 3, '15–20', 'Quad definition finisher'),
      makeEx('Seated Calf Raise', 4, '15–20', 'Slow negatives'),
      makeEx('Oblique Crunches', 4, '20 each side', '🔥 Side fat attack'),
      makeEx('Hanging Leg Raise', 4, '15', 'Lower abs + core tightness'),
      makeEx('Plank', 3, '60 sec', 'Full body brace'),
    ],
  },
  {
    day: 'Day 4', label: 'Shoulders Heavy + Arms', tag: 'DELTS', color: '#F59E0B',
    focus: 'Shoulders are priority — go as heavy as chest day',
    exercises: [
      makeEx('Overhead Barbell Press', 5, '4–6', '🔥 HEAVY — treat like bench press'),
      makeEx('Dumbbell Shoulder Press', 4, '8–10', 'Volume after strength work'),
      makeEx('Lateral Raises', 5, '15–20', 'High volume — width comes from here'),
      makeEx('Cable Lateral Raise', 4, '15–20', 'Better contraction than DB'),
      makeEx('Rear Delt Cable Fly', 4, '15–20', '3D shoulder look + posture'),
      makeEx('Face Pulls', 3, '20', 'Shoulder health — never skip'),
      makeEx('EZ Bar Curl (heavy)', 4, '6–8', '🔥 Heavy bicep work'),
      makeEx('Cable Curl (peak contraction)', 3, '12–15', 'Squeeze at top'),
      makeEx('Close Grip Bench Press', 3, '8–10', 'Tricep mass'),
    ],
  },
  {
    day: 'Day 5', label: 'Legs — Hamstrings + Core', tag: 'LEGS', color: '#A855F7',
    focus: 'Hamstrings + heavy oblique work for side fat',
    exercises: [
      makeEx('Romanian Deadlift', 4, '8–10', 'Full hamstring stretch'),
      makeEx('Lying Leg Curl', 4, '10–12', '3 sec slow negative'),
      makeEx('Walking Lunges', 3, '12 each', 'Glute + ham combo'),
      makeEx('Standing Calf Raise', 5, '12–15', 'Full range only'),
      makeEx('Russian Twists (weighted)', 4, '20 each side', '🔥 Side fat — hold plate or DB'),
      makeEx('Side Plank', 3, '45 sec each', 'Oblique tightening'),
      makeEx('Cable Woodchoppers', 3, '15 each side', '🔥 Best oblique exercise'),
      makeEx('Ab Wheel / Rollout', 3, '12', 'Full core — destroys love handles'),
    ],
  },
  {
    day: 'Day 6', label: 'Arms + Core (Dedicated)', tag: 'ARMS', color: '#EC4899',
    focus: '🔥 Your lagging point — treat this like chest day, go hard',
    exercises: [
      makeEx('Barbell Curl', 4, '6–8', 'Heavy — progressive overload every week'),
      makeEx('Incline DB Curl', 3, '10–12', 'Long head peak builder'),
      makeEx('Spider Curl (on incline bench)', 3, '12', 'Extreme bicep isolation'),
      makeEx('Cable Curl (both arms)', 3, '15', 'Pump finisher'),
      makeEx('Close Grip Bench Press', 4, '6–8', 'Heavy tricep compound'),
      makeEx('Skull Crushers', 3, '10–12', 'Tricep mass'),
      makeEx('Tricep Pushdown (rope)', 3, '15', 'Pump + definition'),
      makeEx('Overhead Tricep Extension', 3, '12', 'Long head — biggest part of arm'),
      makeEx('Weighted Oblique Crunches', 4, '20 each', '🔥 Side fat finisher'),
      makeEx('Hanging Leg Raise', 3, '15', 'Core tightness'),
    ],
  },
  {
    day: 'Day 7', label: 'Rest & Recovery', tag: 'REST', color: '#6B7280',
    focus: "Growth happens here — don't skip rest",
    exercises: [
      makeEx('Light Walk', 0, '20–30 min', 'Active recovery'),
      makeEx('Stretching / Mobility', 0, '15 min', 'Hips, shoulders, thoracic'),
      makeEx('Sleep 8 hours', 0, 'Non-negotiable', 'Muscle is built here'),
    ],
  },
];

// ── Store ──────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeDay: getTodayIndex(),
      customPlan: DEFAULT_PLAN,
      workoutHistory: {},
      stepsCount: 0,
      lastCheckWeek: getWeekKey(),
      unit: 'kg',
      manualWalkCompleted: false,
      exerciseWeights: {},

      setActiveDay: (day) => set({ activeDay: day }),

      toggleManualWalk: () => set((s) => ({ manualWalkCompleted: !s.manualWalkCompleted })),

      toggleUnit: () => set((s) => ({ unit: s.unit === 'kg' ? 'lbs' : 'kg' })),

      // ── Plan editing ──

      renameExercise: (dayIndex, exerciseId, newName) => {
        set((state) => {
          const newPlan = [...state.customPlan];
          const day = newPlan[dayIndex];
          if (!day) return state;

          const newExercises = day.exercises.map((ex) =>
            ex.id === exerciseId ? { ...ex, name: newName } : ex
          );

          newPlan[dayIndex] = { ...day, exercises: newExercises };
          return { customPlan: newPlan };
        });
      },

      addExercise: (dayIndex, name, sets, reps, note) => {
        set((state) => {
          const newPlan = [...state.customPlan];
          const day = newPlan[dayIndex];
          if (!day) return state;

          newPlan[dayIndex] = {
            ...day,
            exercises: [...day.exercises, { id: genId(), name, sets, reps, note }],
          };
          return { customPlan: newPlan };
        });
      },

      deleteExercise: (dayIndex, exerciseId) => {
        set((state) => {
          const newPlan = [...state.customPlan];
          const day = newPlan[dayIndex];
          if (!day) return state;

          newPlan[dayIndex] = {
            ...day,
            exercises: day.exercises.filter((e) => e.id !== exerciseId),
          };
          return { customPlan: newPlan };
        });
      },

      updateExerciseSetCount: (dayIndex, exerciseId, newCount) => {
        set((state) => {
          const newPlan = [...state.customPlan];
          const day = newPlan[dayIndex];
          if (!day) return state;

          const newExercises = day.exercises.map((ex) =>
            ex.id === exerciseId ? { ...ex, sets: Math.max(1, newCount) } : ex
          );

          newPlan[dayIndex] = { ...day, exercises: newExercises };
          return { customPlan: newPlan };
        });
      },

      // ── Per-set tracking ──

      getExerciseSets: (weekKey, dayIndex, exerciseId, setCount) => {
        const { workoutHistory } = get();
        const weekData = workoutHistory[weekKey];
        const dayData = weekData?.days[dayIndex];
        const exData = dayData?.exercises[exerciseId];
        const saved = exData?.sets || [];

        // Ensure we always return the correct number of sets
        const result: SetData[] = [];
        for (let i = 0; i < setCount; i++) {
          result.push(saved[i] || { weight: '', reps: '', completed: false });
        }
        return result;
      },

      updateSetData: (weekKey, dayIndex, exerciseId, setIndex, field, value) => {
        set((state) => {
          const history = { ...state.workoutHistory };
          const week = { ...(history[weekKey] || { days: {} }) };
          const days = { ...week.days };
          const day = { ...(days[dayIndex] || { exercises: {} }) };
          const exercises = { ...day.exercises };
          const ex = { ...(exercises[exerciseId] || { sets: [] }) };
          const sets = [...ex.sets];

          while (sets.length <= setIndex) {
            sets.push({ weight: '', reps: '', completed: false });
          }
          sets[setIndex] = { ...sets[setIndex], [field]: value };

          exercises[exerciseId] = { ...ex, sets };
          day.exercises = exercises;
          days[dayIndex] = day;
          week.days = days;
          history[weekKey] = week;

          return { workoutHistory: history };
        });
      },

      toggleSetCompleted: (weekKey, dayIndex, exerciseId, setIndex) => {
        set((state) => {
          const history = { ...state.workoutHistory };
          const week = { ...(history[weekKey] || { days: {} }) };
          const days = { ...week.days };
          const day = { ...(days[dayIndex] || { exercises: {} }) };
          const exercises = { ...day.exercises };
          const ex = { ...(exercises[exerciseId] || { sets: [] }) };
          const sets = [...ex.sets];

          while (sets.length <= setIndex) {
            sets.push({ weight: '', reps: '', completed: false });
          }
          sets[setIndex] = { ...sets[setIndex], completed: !sets[setIndex].completed };

          exercises[exerciseId] = { ...ex, sets };
          day.exercises = exercises;
          days[dayIndex] = day;
          week.days = days;
          history[weekKey] = week;

          return { workoutHistory: history };
        });
      },

      syncExerciseSets: (weekKey, dayIndex, exerciseId, setCount) => {
        set((state) => {
          const history = { ...state.workoutHistory };
          const week = { ...(history[weekKey] || { days: {} }) };
          const days = { ...week.days };
          const day = { ...(days[dayIndex] || { exercises: {} }) };
          const exercises = { ...day.exercises };
          const ex = { ...(exercises[exerciseId] || { sets: [] }) };
          const sets = [...ex.sets];

          if (sets.length === 0) return state;
          const firstSet = sets[0];

          for (let i = 0; i < setCount; i++) {
            sets[i] = {
              ...(sets[i] || { completed: false, weight: '', reps: '' }),
              weight: firstSet.weight,
              reps: firstSet.reps,
            };
          }

          exercises[exerciseId] = { ...ex, sets };
          day.exercises = exercises;
          days[dayIndex] = day;
          week.days = days;
          history[weekKey] = week;

          return { workoutHistory: history };
        });
      },

      // ── Misc ──

      updateSteps: (steps) => set({ stepsCount: steps }),

      checkReset: () => {
        const currentWeekKey = getWeekKey();
        const { lastCheckWeek } = get();
        if (lastCheckWeek !== currentWeekKey) {
          set({
            stepsCount: 0,
            manualWalkCompleted: false,
            lastCheckWeek: currentWeekKey,
          });
        }
      },
    }),
    {
      name: 'workout-storage-v5',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
