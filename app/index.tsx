import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  AppState,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pedometer } from 'expo-sensors';
import { CheckCircle2, Circle, Footprints, Flame, Trophy, Scale, CheckCircle } from 'lucide-react-native';
import { useWorkoutStore } from '@/hooks/useWorkoutStore';

const plan = {
  days: [
    {
      day: 'Day 1',
      label: 'Push — Chest Heavy',
      tag: 'PUSH',
      color: '#FF6B35',
      focus: 'Chest is your strength — keep it heavy, efficient',
      exercises: [
        { name: 'Flat Barbell Bench Press', sets: '5', reps: '4–6', note: 'Heavy — this is your strength day' },
        { name: 'Incline Dumbbell Press', sets: '4', reps: '8–10', note: 'Upper chest shape' },
        { name: 'Pec Deck / Cable Fly', sets: '3', reps: '12–15', note: 'Inner chest definition, squeeze hard' },
        { name: 'Tricep Pushdown (rope)', sets: '4', reps: '12–15', note: 'Keep elbows pinned' },
        { name: 'Overhead Tricep Extension', sets: '3', reps: '12–15', note: 'Long head — makes arms look bigger' },
        { name: 'Skull Crushers (EZ bar)', sets: '3', reps: '10–12', note: 'Tri mass builder' },
      ],
    },
    {
      day: 'Day 2',
      label: 'Pull — Back Heavy',
      tag: 'PULL',
      color: '#4ECDC4',
      focus: 'Back is your strength — go heavy, build thickness',
      exercises: [
        { name: 'Deadlift or T-Bar Row', sets: '5', reps: '4–6', note: 'Your main heavy movement' },
        { name: 'Weighted Pull-Ups / Lat Pulldown', sets: '4', reps: '6–8', note: 'V-taper — go heavy' },
        { name: 'Barbell Row', sets: '4', reps: '6–8', note: 'Mid back thickness' },
        { name: 'Seated Cable Row', sets: '3', reps: '10–12', note: 'Full stretch and squeeze' },
        { name: 'Barbell Curl', sets: '4', reps: '8–10', note: 'Bicep peak — strict form only' },
        { name: 'Incline Dumbbell Curl', sets: '3', reps: '10–12', note: 'Long head stretch = more peak' },
        { name: 'Hammer Curl', sets: '3', reps: '12', note: 'Brachialis — makes arms look thick' },
      ],
    },
    {
      day: 'Day 3',
      label: 'Legs — Quads & Core',
      tag: 'LEGS',
      color: '#A855F7',
      focus: 'Quads + heavy core work to attack side fat',
      exercises: [
        { name: 'Barbell Back Squat', sets: '4', reps: '5–7', note: 'Heavy compound — no skipping' },
        { name: 'Leg Press', sets: '3', reps: '10–12', note: 'Quad + glute drive' },
        { name: 'Bulgarian Split Squat', sets: '3', reps: '10 each', note: 'Fixes imbalances' },
        { name: 'Leg Extension', sets: '3', reps: '15–20', note: 'Quad definition finisher' },
        { name: 'Seated Calf Raise', sets: '4', reps: '15–20', note: 'Slow negatives' },
        { name: 'Oblique Crunches', sets: '4', reps: '20 each side', note: '🔥 Side fat attack' },
        { name: 'Hanging Leg Raise', sets: '4', reps: '15', note: 'Lower abs + core tightness' },
        { name: 'Plank', sets: '3', reps: '60 sec', note: 'Full body brace' },
      ],
    },
    {
      day: 'Day 4',
      label: 'Shoulders Heavy + Arms',
      tag: 'DELTS',
      color: '#F59E0B',
      focus: 'Shoulders are priority — go as heavy as chest day',
      exercises: [
        { name: 'Overhead Barbell Press', sets: '5', reps: '4–6', note: '🔥 HEAVY — treat like bench press' },
        { name: 'Dumbbell Shoulder Press', sets: '4', reps: '8–10', note: 'Volume after strength work' },
        { name: 'Lateral Raises', sets: '5', reps: '15–20', note: 'High volume — width comes from here' },
        { name: 'Cable Lateral Raise', sets: '4', reps: '15–20', note: 'Better contraction than DB' },
        { name: 'Rear Delt Cable Fly', sets: '4', reps: '15–20', note: '3D shoulder look + posture' },
        { name: 'Face Pulls', sets: '3', reps: '20', note: 'Shoulder health — never skip' },
        { name: 'EZ Bar Curl (heavy)', sets: '4', reps: '6–8', note: '🔥 Heavy bicep work' },
        { name: 'Cable Curl (peak contraction)', sets: '3', reps: '12–15', note: 'Squeeze at top' },
        { name: 'Close Grip Bench Press', sets: '3', reps: '8–10', note: 'Tricep mass' },
      ],
    },
    {
      day: 'Day 5',
      label: 'Legs — Hamstrings + Core',
      tag: 'LEGS',
      color: '#A855F7',
      focus: 'Hamstrings + heavy oblique work for side fat',
      exercises: [
        { name: 'Romanian Deadlift', sets: '4', reps: '8–10', note: 'Full hamstring stretch' },
        { name: 'Lying Leg Curl', sets: '4', reps: '10–12', note: '3 sec slow negative' },
        { name: 'Walking Lunges', sets: '3', reps: '12 each', note: 'Glute + ham combo' },
        { name: 'Standing Calf Raise', sets: '5', reps: '12–15', note: 'Full range only' },
        { name: 'Russian Twists (weighted)', sets: '4', reps: '20 each side', note: '🔥 Side fat — hold plate or DB' },
        { name: 'Side Plank', sets: '3', reps: '45 sec each', note: 'Oblique tightening' },
        { name: 'Cable Woodchoppers', sets: '3', reps: '15 each side', note: '🔥 Best oblique exercise' },
        { name: 'Ab Wheel / Rollout', sets: '3', reps: '12', note: 'Full core — destroys love handles' },
      ],
    },
    {
      day: 'Day 6',
      label: 'Arms + Core (Dedicated)',
      tag: 'ARMS',
      color: '#EC4899',
      focus: '🔥 Your lagging point — treat this like chest day, go hard',
      exercises: [
        { name: 'Barbell Curl', sets: '4', reps: '6–8', note: 'Heavy — progressive overload every week' },
        { name: 'Incline DB Curl', sets: '3', reps: '10–12', note: 'Long head peak builder' },
        { name: 'Spider Curl (on incline bench)', sets: '3', reps: '12', note: 'Extreme bicep isolation' },
        { name: 'Cable Curl (both arms)', sets: '3', reps: '15', note: 'Pump finisher' },
        { name: 'Close Grip Bench Press', sets: '4', reps: '6–8', note: 'Heavy tricep compound' },
        { name: 'Skull Crushers', sets: '3', reps: '10–12', note: 'Tricep mass' },
        { name: 'Tricep Pushdown (rope)', sets: '3', reps: '15', note: 'Pump + definition' },
        { name: 'Overhead Tricep Extension', sets: '3', reps: '12', note: 'Long head — biggest part of arm' },
        { name: 'Weighted Oblique Crunches', sets: '4', reps: '20 each', note: '🔥 Side fat finisher' },
        { name: 'Hanging Leg Raise', sets: '3', reps: '15', note: 'Core tightness' },
      ],
    },
    {
      day: 'Day 7',
      label: 'Rest & Recovery',
      tag: 'REST',
      color: '#6B7280',
      focus: 'Growth happens here — don\'t skip rest',
      exercises: [
        { name: 'Light Walk', sets: '—', reps: '20–30 min', note: 'Active recovery' },
        { name: 'Stretching / Mobility', sets: '—', reps: '15 min', note: 'Hips, shoulders, thoracic' },
        { name: 'Sleep 8 hours', sets: '—', reps: 'Non-negotiable', note: 'Muscle is built here' },
      ],
    },
  ],
};

const tagBg: Record<string, string> = {
  PUSH:  'rgba(255,107,53,0.12)',
  PULL:  'rgba(78,205,196,0.12)',
  LEGS:  'rgba(168,85,247,0.12)',
  DELTS: 'rgba(245,158,11,0.12)',
  ARMS:  'rgba(236,72,153,0.12)',
  REST:  'rgba(107,114,128,0.12)',
};

const splitOverview = [
  { day: 'Mon', tag: 'PUSH',  color: '#FF6B35' },
  { day: 'Tue', tag: 'PULL',  color: '#4ECDC4' },
  { day: 'Wed', tag: 'LEGS',  color: '#A855F7' },
  { day: 'Thu', tag: 'DELTS', color: '#F59E0B' },
  { day: 'Fri', tag: 'LEGS',  color: '#A855F7' },
  { day: 'Sat', tag: 'ARMS',  color: '#EC4899' },
  { day: 'Sun', tag: 'REST',  color: '#6B7280' },
];

const STEP_GOAL = 10000;

const getWeekKey = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
};

export default function WorkoutPlan() {
  const { 
    activeDay, 
    setActiveDay, 
    workoutHistory,
    toggleExercise, 
    setWeight,
    stepsCount, 
    updateSteps, 
    checkReset,
    getLastWeekWeight,
    unit,
    toggleUnit,
    manualWalkCompleted,
    toggleManualWalk,
    exerciseWeights
  } = useWorkoutStore();

  const insets = useSafeAreaInsets();
  const weekKey = useMemo(() => getWeekKey(), []);
  
  const currentWorkout = useMemo(() => {
    const weekData = workoutHistory[weekKey] || { days: {} };
    return weekData.days[activeDay] || { exercises: {} };
  }, [workoutHistory, weekKey, activeDay]);
  
  const current = useMemo(() => plan.days[activeDay], [activeDay]);

  useEffect(() => {
    checkReset();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkReset();
      }
    });
    return () => subscription.remove();
  }, [checkReset]);

  useEffect(() => {
    let subscription: any = null;
    const subscribe = async () => {
      try {
        const isAvailable = await Pedometer.isAvailableAsync();
        if (isAvailable) {
          const { status } = await Pedometer.requestPermissionsAsync();
          if (status === 'granted') {
            subscription = Pedometer.watchStepCount(result => {
              if (result && typeof result.steps === 'number') {
                updateSteps(result.steps);
              }
            });
          }
        }
      } catch (e) {
        console.error('Pedometer error:', e);
      }
    };
    subscribe();
    return () => {
      if (subscription) subscription.remove();
    };
  }, [updateSteps]);

  const stepProgress = Math.min(stepsCount / STEP_GOAL, 1);
  const isStepGoalReached = stepsCount >= STEP_GOAL || manualWalkCompleted;

  return (
    <View style={[styles.safe, { backgroundColor: '#0A0A0F' }]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.badge}>PhysiqueX Training</Text>
              <Text style={styles.title}>Daily Progress</Text>
            </View>
            
            <TouchableOpacity onPress={toggleUnit} style={styles.unitSelector} activeOpacity={0.7}>
              <Scale size={14} color="#A0A0C0" />
              <Text style={styles.unitSelectorText}>{unit.toUpperCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={toggleManualWalk} 
              activeOpacity={0.7} 
              style={[styles.stepIndicator, isStepGoalReached && styles.stepIndicatorSuccess]}
            >
               {isStepGoalReached ? <CheckCircle size={18} color="#00C853" /> : <Footprints size={18} color="#4ECDC4" />}
               <Text style={[styles.stepIndicatorText, isStepGoalReached && { color: '#00C853' }]}>
                 {stepsCount.toLocaleString()} / {STEP_GOAL.toLocaleString()}
               </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.stepProgressContainer}>
            <View style={[styles.stepProgessFill, { width: `${stepProgress * 100}%` }, isStepGoalReached && { backgroundColor: '#00C853' }]} />
          </View>

          <View style={styles.badgeRow}>
            {isStepGoalReached && (
              <View style={[styles.chip, { borderColor: '#00C853', backgroundColor: 'rgba(0,200,83,0.1)' }]}>
                <Text style={[styles.chipText, { color: '#00C853' }]}>✅ Daily Walk Completed</Text>
              </View>
            )}
            {[['💪', 'Arms 2x/week'], ['🔥', 'Core 3x/week']].map(([icon, label]) => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipText}>{icon} {label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
            {splitOverview.map((s, i) => (
              <TouchableOpacity key={i} onPress={() => setActiveDay(i)} style={[styles.dayBtn, activeDay === i && { backgroundColor: s.color + '28', borderColor: s.color }]}>
                <Text style={[styles.dayBtnText, activeDay === i && { color: '#fff' }]}>{s.day}</Text>
                <Text style={[styles.dayBtnTag, { color: activeDay === i ? s.color : '#404060' }]}>{s.tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.dayCard, { backgroundColor: tagBg[current.tag], borderColor: current.color + '44' }]}>
            <Text style={[styles.dayCardTag, { color: current.color }]}>{current.tag} · {current.day}</Text>
            <Text style={styles.dayCardLabel}>{current.label}</Text>
            <Text style={styles.dayCardFocus}>{current.focus}</Text>
          </View>

          {current.exercises.map((ex, i) => {
            const isHot = ex.note.includes('🔥');
            const exerciseState = (currentWorkout.exercises && currentWorkout.exercises[ex.name]) || { weight: '', completed: false };
            const lastWeight = getLastWeekWeight(activeDay, ex.name);
            const displayWeight = exerciseState.weight || exerciseWeights[ex.name] || '';
            
            return (
              <View key={i} style={[styles.exCard, isHot && styles.exCardHot, exerciseState.completed && styles.exCardCompleted]}>
                <TouchableOpacity onPress={() => toggleExercise(weekKey, activeDay, ex.name)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.exCheck}>
                   {exerciseState.completed ? <CheckCircle2 size={24} color={current.color} /> : <Circle size={24} color="rgba(255,255,255,0.1)" />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.exInfo} activeOpacity={1} onPress={() => toggleExercise(weekKey, activeDay, ex.name)}>
                  <Text style={[styles.exName, exerciseState.completed && styles.textStrikethrough]}>{ex.name}</Text>
                  <View style={styles.exRow}>
                    <Text style={styles.exTarget}>{ex.sets} × {ex.reps}</Text>
                    {lastWeight && <Text style={styles.exLast}>Last: {lastWeight}{unit}</Text>}
                  </View>
                </TouchableOpacity>
                {ex.sets !== '—' && (
                  <View style={[styles.weightInputContainer, { borderColor: displayWeight ? current.color : 'rgba(255,255,255,0.1)' }]}>
                    <TextInput
                      style={styles.weightInput}
                      placeholder={`— ${unit}`}
                      placeholderTextColor="#404060"
                      keyboardType="numeric"
                      returnKeyType="done"
                      value={displayWeight}
                      onChangeText={(text) => setWeight(weekKey, activeDay, ex.name, text)}
                    />
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.tip}>
            <Text style={styles.tipText}>⏱ Weekly Progress: Weights and checks are preserved until Sunday. Resets Monday morning.</Text>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', backgroundColor: '#0F0F1A' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  badge: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#EC4899', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  unitSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  unitSelectorText: { color: '#A0A0C0', fontSize: 11, fontWeight: '800' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(78,205,196,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(78,205,196,0.2)' },
  stepIndicatorSuccess: { backgroundColor: 'rgba(0,200,83,0.1)', borderColor: 'rgba(0,200,83,0.3)' },
  stepIndicatorText: { color: '#4ECDC4', fontSize: 13, fontWeight: '800' },
  stepProgressContainer: { height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 16, overflow: 'hidden' },
  stepProgessFill: { height: '100%', backgroundColor: '#4ECDC4', borderRadius: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '600', color: '#A0A0C0' },
  dayScroll: { backgroundColor: '#0A0A0F' },
  dayScrollContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 10, flexDirection: 'row', alignItems: 'center' },
  dayBtn: { backgroundColor: '#161622', borderWidth: 1.5, borderColor: 'transparent', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 65 },
  dayBtnText: { fontSize: 13, fontWeight: '800', color: '#6060A0' },
  dayBtnTag: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 2, textTransform: 'uppercase' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  dayCard: { borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 8 },
  dayCardTag: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  dayCardLabel: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 6 },
  dayCardFocus: { fontSize: 14, color: '#8080A0', marginTop: 8, lineHeight: 20 },
  exCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161622', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 14, gap: 12 },
  exCardHot: { backgroundColor: 'rgba(236,72,153,0.03)', borderColor: 'rgba(236,72,153,0.15)' },
  exCardCompleted: { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.02)' },
  exCheck: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  exInfo: { flex: 1 },
  exName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  textStrikethrough: { textDecorationLine: 'line-through', color: '#606080' },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exTarget: { fontSize: 12, fontWeight: '600', color: '#7070A0' },
  exLast: { fontSize: 11, fontWeight: '700', color: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  weightInputContainer: { width: 70, height: 36, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', paddingHorizontal: 8 },
  weightInput: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center', padding: 0 },
  tip: { backgroundColor: 'rgba(255,107,53,0.04)', borderWidth: 1, borderColor: 'rgba(255,107,53,0.1)', borderRadius: 16, padding: 16, marginTop: 10 },
  tipText: { fontSize: 12, color: '#A08070', lineHeight: 18, textAlign: 'center', fontStyle: 'italic' },
});
