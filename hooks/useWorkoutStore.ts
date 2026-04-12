import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ExerciseData {
  weight: string;
  completed: boolean;
}

interface RecordedDay {
  exercises: Record<string, ExerciseData>;
}

interface RecordedWeek {
  days: Record<number, RecordedDay>; // dayIndex (0-6) -> RecordedDay
}

interface WorkoutState {
  activeDay: number;
  workoutHistory: Record<string, RecordedWeek>; // WeekKey (YYYY-MM-DD of Monday) -> Workout
  stepsCount: number;
  lastCheckWeek: string; // YYYY-MM-DD of Monday
  unit: 'kg' | 'lbs';
  manualWalkCompleted: boolean;
  exerciseWeights: Record<string, string>; // exerciseName -> weight (PERSISTENT)
  
  // Actions
  setActiveDay: (day: number) => void;
  toggleExercise: (weekKey: string, dayIndex: number, exerciseName: string) => void;
  setWeight: (weekKey: string, dayIndex: number, exerciseName: string, weight: string) => void;
  updateSteps: (steps: number) => void;
  checkReset: () => void;
  getLastWeekWeight: (dayIndex: number, exerciseName: string) => string | null;
  toggleUnit: () => void;
  toggleManualWalk: () => void;
}

const getTodayIndex = () => {
  const day = new Date().getDay();
  return (day + 6) % 7; // Mon: 0, Tue: 1, ..., Sun: 6
};

const getWeekKey = () => {
  const now = new Date();
  const day = now.getDay(); // 0(Sun) - 6(Sat)
  // Find the Monday of the current week
  const diff = now.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
};

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeDay: getTodayIndex(),
      workoutHistory: {},
      stepsCount: 0,
      lastCheckWeek: getWeekKey(),
      unit: 'kg',
      manualWalkCompleted: false,
      exerciseWeights: {},

      setActiveDay: (day) => set({ activeDay: day }),
      
      toggleManualWalk: () => set((state) => ({ 
        manualWalkCompleted: !state.manualWalkCompleted 
      })),

      toggleUnit: () => set((state) => ({ 
        unit: state.unit === 'kg' ? 'lbs' : 'kg' 
      })),

      toggleExercise: (weekKey, dayIndex, exerciseName) => {
        const { workoutHistory } = get();
        const weekData = workoutHistory[weekKey] || { days: {} };
        const dayData = weekData.days[dayIndex] || { exercises: {} };
        const exerciseData = dayData.exercises[exerciseName] || { weight: '', completed: false };

        set({
          workoutHistory: {
            ...workoutHistory,
            [weekKey]: {
              ...weekData,
              days: {
                ...weekData.days,
                [dayIndex]: {
                  ...dayData,
                  exercises: {
                    ...dayData.exercises,
                    [exerciseName]: {
                      ...exerciseData,
                      completed: !exerciseData.completed
                    }
                  }
                }
              }
            }
          }
        });
      },

      setWeight: (weekKey, dayIndex, exerciseName, weight) => {
        const { workoutHistory, exerciseWeights } = get();
        const weekData = workoutHistory[weekKey] || { days: {} };
        const dayData = weekData.days[dayIndex] || { exercises: {} };
        const exerciseData = dayData.exercises[exerciseName] || { weight: '', completed: false };

        set({
          exerciseWeights: {
            ...exerciseWeights,
            [exerciseName]: weight
          },
          workoutHistory: {
            ...workoutHistory,
            [weekKey]: {
              ...weekData,
              days: {
                ...weekData.days,
                [dayIndex]: {
                  ...dayData,
                  exercises: {
                    ...dayData.exercises,
                    [exerciseName]: {
                      ...exerciseData,
                      weight: weight
                    }
                  }
                }
              }
            }
          }
        });
      },

      updateSteps: (steps) => set({ stepsCount: steps }),

      checkReset: () => {
        const currentWeekKey = getWeekKey();
        const { lastCheckWeek } = get();

        // Reset if we moved into a new week (starts on Monday)
        if (lastCheckWeek !== currentWeekKey) {
          set({
            stepsCount: 0,
            manualWalkCompleted: false,
            lastCheckWeek: currentWeekKey,
          });
        }
      },

      getLastWeekWeight: (dayIndex, exerciseName) => {
        const { workoutHistory, exerciseWeights } = get();
        
        // If we have a persistent weight, that's what we want to "pre-fill"
        // But the user might want to see what they did LAST week vs CURRENT persistent
        // "getLastWeekWeight" will now prioritize the history from exactly 1 week ago
        const currentWeek = getWeekKey();
        const previousWeeks = Object.keys(workoutHistory)
          .filter(week => week !== currentWeek)
          .sort((a, b) => b.localeCompare(a));
          
        if (previousWeeks.length > 0) {
          const lastWeekData = workoutHistory[previousWeeks[0]];
          const lastSession = lastWeekData.days[dayIndex];
          return lastSession?.exercises[exerciseName]?.weight || exerciseWeights[exerciseName] || null;
        }
        
        return exerciseWeights[exerciseName] || null;
      },
    }),
    {
      name: 'workout-storage-v4', // Incrementing version for new persistent field
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
