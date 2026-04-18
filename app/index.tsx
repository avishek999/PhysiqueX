import { useWorkoutStore, PlanExercise, SetData } from '@/hooks/useWorkoutStore';
import { Pedometer } from 'expo-sensors';
import {
  CheckCircle,
  CheckCircle2,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Circle,
  Footprints,
  Pencil,
  Plus,
  Scale,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// ── Set Row Component ──────────────────────────────────────

function SetRow({
  setIndex,
  data,
  color,
  unit,
  onToggle,
  onUpdate,
  exerciseName,
  onWeightInputRef,
  onFocusNext,
}: {
  setIndex: number;
  data: SetData;
  color: string;
  unit: string;
  onToggle: () => void;
  onUpdate: (field: 'weight' | 'reps', value: string) => void;
  exerciseName: string;
  onWeightInputRef?: (el: TextInput | null) => void;
  onFocusNext?: () => void;
}) {
  const [localWeight, setLocalWeight] = useState(data.weight);
  const [localReps, setLocalReps] = useState(data.reps);
  const repsRef = useRef<TextInput>(null);

  const isHeavy = useMemo(() => {
    const name = exerciseName.toLowerCase();
    return name.includes('bench') || name.includes('deadlift') || name.includes('squat') || name.includes('press');
  }, [exerciseName]);

  const targetWeightLength = isHeavy ? 3 : 2;

  // Sync from store → local when the store value changes externally
  useEffect(() => { setLocalWeight(data.weight); }, [data.weight]);
  useEffect(() => { setLocalReps(data.reps); }, [data.reps]);

  return (
    <View style={[styles.setRow, data.completed && styles.setRowCompleted]}>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.setCheckBtn}
        activeOpacity={0.6}
      >
        {data.completed
          ? <CheckCircle2 size={22} color={color} />
          : <Circle size={22} color="rgba(255,255,255,0.15)" />
        }
      </TouchableOpacity>

      <Text style={[styles.setLabel, data.completed && { color: '#404060' }]}>
        Set {setIndex + 1}
      </Text>

      <View style={styles.setInputGroup}>
        <View style={[styles.setInputWrap, { borderColor: localWeight ? color : 'rgba(255,255,255,0.08)' }]}>
          <TextInput
            ref={onWeightInputRef}
            style={styles.setInput}
            placeholder={`— ${unit}`}
            placeholderTextColor="#404060"
            keyboardType="numeric"
            returnKeyType="done"
            value={localWeight}
            onChangeText={(v) => {
              setLocalWeight(v);
              onUpdate('weight', v);
              if (v.length >= targetWeightLength) {
                repsRef.current?.focus();
              }
            }}
            onBlur={() => onUpdate('weight', localWeight)}
            onSubmitEditing={() => onUpdate('weight', localWeight)}
          />
        </View>

        <Text style={styles.setX}>×</Text>

        <View style={[styles.setInputWrap, { borderColor: localReps ? color : 'rgba(255,255,255,0.08)' }]}>
          <TextInput
            ref={repsRef}
            style={styles.setInput}
            placeholder="— reps"
            placeholderTextColor="#404060"
            keyboardType="numeric"
            returnKeyType="done"
            value={localReps}
            onChangeText={(v) => {
              setLocalReps(v);
              onUpdate('reps', v);
              if (v.length >= 2) {
                onFocusNext?.();
              }
            }}
            onBlur={() => onUpdate('reps', localReps)}
            onSubmitEditing={() => onUpdate('reps', localReps)}
          />
        </View>
      </View>
    </View>
  );
}

// ── Exercise Accordion Card ──────────────────────────────────

function ExerciseCard({
  exercise,
  dayIndex,
  weekKey,
  color,
  unit,
  isExpanded,
  onToggleExpand,
}: {
  exercise: PlanExercise;
  dayIndex: number;
  weekKey: string;
  color: string;
  unit: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const {
    workoutHistory,
    updateSetData,
    toggleSetCompleted,
    renameExercise,
    deleteExercise,
    updateExerciseSetCount,
    syncExerciseSets,
  } = useWorkoutStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(exercise.name);
  const weightRefs = useRef<Record<number, TextInput | null>>({});

  // Compute sets data directly from workoutHistory so the component re-renders on changes
  const setsData = useMemo(() => {
    const weekData = workoutHistory[weekKey];
    const dayData = weekData?.days[dayIndex];
    const exData = dayData?.exercises[exercise.id];
    const saved = exData?.sets || [];
    const result: SetData[] = [];
    for (let i = 0; i < exercise.sets; i++) {
      result.push(saved[i] || { weight: '', reps: '', completed: false });
    }
    return result;
  }, [workoutHistory, weekKey, dayIndex, exercise.id, exercise.sets]);

  const completedSets = setsData.filter(s => s.completed).length;
  const allComplete = completedSets === exercise.sets && exercise.sets > 0;
  const isHot = exercise.note.includes('🔥');
  const isRestDay = exercise.sets === 0;

  const handleSaveName = () => {
    if (editName.trim()) {
      renameExercise(dayIndex, exercise.id, editName.trim());
    } else {
      setEditName(exercise.name);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Exercise',
      `Remove "${exercise.name}" from this day?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            deleteExercise(dayIndex, exercise.id);
          },
        },
      ]
    );
  };

  const handleSetCountChange = (delta: number) => {
    const newCount = exercise.sets + delta;
    if (newCount >= 1 && newCount <= 10) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      updateExerciseSetCount(dayIndex, exercise.id, newCount);
    }
  };

  // Rest day items — simple non-expandable card
  if (isRestDay) {
    return (
      <View style={[styles.exCard, { opacity: 0.8 }]}>
        <View style={styles.restIcon}>
          <Text style={{ fontSize: 16 }}>🧘</Text>
        </View>
        <View style={styles.exInfo}>
          <Text style={styles.exName}>{exercise.name}</Text>
          <Text style={styles.exTarget}>{exercise.reps}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.exCard, isHot && styles.exCardHot, allComplete && styles.exCardCompleted, isExpanded && styles.exCardExpanded]}>
      {/* ── Header Row (always visible) ── */}
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggleExpand();
        }}
        onLongPress={() => {
          setEditName(exercise.name);
          setIsEditing(true);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.completionDot, allComplete ? { backgroundColor: color } : {}]} />

        <View style={styles.exInfo}>
          {isEditing ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={styles.editNameInput}
                value={editName}
                onChangeText={setEditName}
                onBlur={handleSaveName}
                onSubmitEditing={handleSaveName}
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity onPress={handleSaveName}>
                <CheckCircle size={18} color={color} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.exName, allComplete && styles.textStrikethrough]} numberOfLines={1}>
              {exercise.name}
            </Text>
          )}

          <View style={styles.exRow}>
            <Text style={styles.exTarget}>{exercise.sets} × {exercise.reps}</Text>
            <View style={[styles.progressPill, allComplete && { borderColor: color, backgroundColor: color + '18' }]}>
              <Text style={[styles.progressPillText, allComplete && { color }]}>
                {completedSets}/{exercise.sets}
              </Text>
            </View>
          </View>
        </View>

        {isExpanded
          ? <ChevronUp size={18} color="#606080" />
          : <ChevronDown size={18} color="#606080" />
        }
      </TouchableOpacity>

      {/* ── Expanded Content ── */}
      {isExpanded && (
        <View style={styles.accordionBody}>
          {/* Note */}
          <Text style={styles.exNote}>{exercise.note}</Text>

          {/* Set Rows */}
          {setsData.map((s, i) => (
            <SetRow
              key={i}
              setIndex={i}
              data={s}
              color={color}
              unit={unit}
              onToggle={() => toggleSetCompleted(weekKey, dayIndex, exercise.id, i)}
              onUpdate={(field, value) => updateSetData(weekKey, dayIndex, exercise.id, i, field, value)}
              exerciseName={exercise.name}
              onWeightInputRef={(el) => (weightRefs.current[i] = el)}
              onFocusNext={() => weightRefs.current[i + 1]?.focus()}
            />
          ))}

          {/* Actions Row */}
          <View style={styles.actionsRow}>
            <View style={styles.setCountActions}>
              <TouchableOpacity onPress={() => handleSetCountChange(-1)} style={styles.setCountBtn}>
                <Text style={styles.setCountBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.setCountLabel}>{exercise.sets} sets</Text>
              <TouchableOpacity onPress={() => handleSetCountChange(1)} style={styles.setCountBtn}>
                <Text style={styles.setCountBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.exActions}>
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  syncExerciseSets(weekKey, dayIndex, exercise.id, exercise.sets);
                }}
                style={styles.actionBtn}
              >
                <CheckCheck size={14} color={color} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditName(exercise.name); setIsEditing(true); }} style={styles.actionBtn}>
                <Pencil size={14} color="#606080" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
                <Trash2 size={14} color="#FF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Add Exercise Sheet ──────────────────────────────────

function AddExerciseButton({ dayIndex, color }: { dayIndex: number; color: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10–12');
  const { addExercise } = useWorkoutStore();

  const handleAdd = () => {
    if (!name.trim()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addExercise(dayIndex, name.trim(), parseInt(sets) || 3, reps || '10–12', '');
    setName('');
    setSets('3');
    setReps('10–12');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsAdding(true);
        }}
        activeOpacity={0.7}
      >
        <Plus size={18} color={color} />
        <Text style={[styles.addBtnText, { color }]}>Add Exercise</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.addForm, { borderColor: color + '44' }]}>
      <View style={styles.addFormHeader}>
        <Text style={[styles.addFormTitle, { color }]}>New Exercise</Text>
        <TouchableOpacity onPress={() => setIsAdding(false)}>
          <X size={18} color="#606080" />
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.addFormInput}
        placeholder="Exercise name..."
        placeholderTextColor="#404060"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <View style={styles.addFormRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.addFormLabel}>Sets</Text>
          <TextInput
            style={styles.addFormInputSmall}
            keyboardType="numeric"
            value={sets}
            onChangeText={setSets}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.addFormLabel}>Target Reps</Text>
          <TextInput
            style={styles.addFormInputSmall}
            value={reps}
            onChangeText={setReps}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.addFormSubmit, { backgroundColor: color }]}
        onPress={handleAdd}
        activeOpacity={0.8}
      >
        <Text style={styles.addFormSubmitText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────

export default function WorkoutPlan() {
  const {
    activeDay,
    setActiveDay,
    customPlan,
    stepsCount,
    checkReset,
    unit,
    toggleUnit,
    manualWalkCompleted,
    toggleManualWalk,
  } = useWorkoutStore();

  const insets = useSafeAreaInsets();
  const weekKey = useMemo(() => getWeekKey(), []);
  const current = useMemo(() => customPlan[activeDay], [customPlan, activeDay]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    checkReset();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') checkReset();
    });
    return () => subscription.remove();
  }, [checkReset]);

  // TODO: Pedometer step counting — disabled for now, needs debugging on Android release builds
  // useEffect(() => { ... }, []);

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
              <TouchableOpacity
                key={i}
                onPress={() => {
                  setActiveDay(i);
                  setExpandedId(null);
                }}
                style={[styles.dayBtn, activeDay === i && { backgroundColor: s.color + '28', borderColor: s.color }]}
              >
                <Text style={[styles.dayBtnText, activeDay === i && { color: '#fff' }]}>{s.day}</Text>
                <Text style={[styles.dayBtnTag, { color: activeDay === i ? s.color : '#404060' }]}>{s.tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.dayCard, { backgroundColor: tagBg[current.tag], borderColor: current.color + '44' }]}>
            <Text style={[styles.dayCardTag, { color: current.color }]}>{current.tag} · {current.day}</Text>
            <Text style={styles.dayCardLabel}>{current.label}</Text>
            <Text style={styles.dayCardFocus}>{current.focus}</Text>
          </View>

          {current.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              dayIndex={activeDay}
              weekKey={weekKey}
              color={current.color}
              unit={unit}
              isExpanded={expandedId === ex.id}
              onToggleExpand={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setExpandedId(expandedId === ex.id ? null : ex.id);
              }}
            />
          ))}

          {current.tag !== 'REST' && (
            <AddExerciseButton dayIndex={activeDay} color={current.color} />
          )}

          <View style={styles.tip}>
            <Text style={styles.tipText}>⏱ Weekly Progress: Set data resets Monday morning. Your custom exercises are saved permanently.</Text>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────

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

  // Exercise Card / Accordion
  exCard: { backgroundColor: '#161622', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 18, overflow: 'hidden' },
  exCardHot: { backgroundColor: 'rgba(236,72,153,0.03)', borderColor: 'rgba(236,72,153,0.15)' },
  exCardCompleted: { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.02)' },
  exCardExpanded: { borderColor: 'rgba(255,255,255,0.12)' },

  accordionHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  completionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)' },

  exInfo: { flex: 1 },
  exName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  textStrikethrough: { textDecorationLine: 'line-through', color: '#606080' },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exTarget: { fontSize: 12, fontWeight: '600', color: '#7070A0' },

  progressPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  progressPillText: { fontSize: 10, fontWeight: '800', color: '#606080' },

  // Accordion Body
  accordionBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  exNote: { fontSize: 12, color: '#7070A0', fontStyle: 'italic', marginBottom: 4 },

  // Set Row
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 10 },
  setRowCompleted: { opacity: 0.5 },
  setCheckBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  setLabel: { fontSize: 12, fontWeight: '700', color: '#606080', width: 42 },
  setInputGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  setInputWrap: { width: 60, height: 32, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, borderWidth: 1.5, justifyContent: 'center', paddingHorizontal: 6 },
  setInput: { color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center', padding: 0 },
  setX: { color: '#404060', fontSize: 12, fontWeight: '800' },

  // Actions Row
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  setCountActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setCountBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  setCountBtnText: { color: '#A0A0C0', fontSize: 16, fontWeight: '700' },
  setCountLabel: { color: '#606080', fontSize: 12, fontWeight: '700' },
  exActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },

  // Edit Name
  editNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editNameInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)', paddingVertical: 2, padding: 0 },

  // Rest Day
  restIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(107,114,128,0.1)', alignItems: 'center', justifyContent: 'center' },

  // Add Exercise
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' },
  addBtnText: { fontSize: 14, fontWeight: '700' },

  addForm: { backgroundColor: '#161622', borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  addFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addFormTitle: { fontSize: 14, fontWeight: '800' },
  addFormInput: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14, fontWeight: '600' },
  addFormRow: { flexDirection: 'row', gap: 12 },
  addFormLabel: { fontSize: 11, fontWeight: '700', color: '#606080', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  addFormInputSmall: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  addFormSubmit: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  addFormSubmitText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  tip: { backgroundColor: 'rgba(255,107,53,0.04)', borderWidth: 1, borderColor: 'rgba(255,107,53,0.1)', borderRadius: 16, padding: 16, marginTop: 10 },
  tipText: { fontSize: 12, color: '#A08070', lineHeight: 18, textAlign: 'center', fontStyle: 'italic' },
});
