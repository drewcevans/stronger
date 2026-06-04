import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Loader, X } from 'lucide-react';
import { readSheet, appendRow, writeSheet } from '../google/api.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function lsGet(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatWeekLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

function computeBMR(
  weightLbs: number, heightFt: number, heightIn: number,
  age: number, sex: 'male' | 'female',
): number {
  const kg = weightLbs / 2.205;
  const cm = (heightFt * 12 + heightIn) * 2.54;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

function normalizePhase(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '-');
}

function phaseLabel(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type NetStatus = 'ok' | 'over' | 'under' | 'none';
function netStatus(net: number, target: number | null): NetStatus {
  if (target === null) return 'none';
  const diff = net - target;
  if (Math.abs(diff) <= 100) return 'ok';
  return diff > 0 ? 'over' : 'under';
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StaplesRow {
  phase: string;
  calorieOffset: number;
  fatPct: number;
  co2ekg: number;
  useBMR: boolean;
}

interface NutritionEntry {
  localId: string;
  date: string;
  type: string;
  description: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  co2ekg: number;
}

export interface MealRow {
  phase: string;
  meal: string;
  item: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  co2ekg: number;
}

interface Props { initialDate?: string; meals?: MealRow[]; }

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAILY_CO2_TARGET = 900 / 365; // ~2.47 kg/day (midpoint of 0.75-1.0t annual goal)

const MEAL_SLOTS = [
  { id: 'morning-snack', label: 'Morning Snack' },
  { id: 'lunch',         label: 'Lunch'          },
  { id: 'pre-workout',   label: 'Pre-Workout'    },
  { id: 'post-workout',  label: 'Post-Workout'   },
  { id: 'dinner',        label: 'Dinner'         },
  { id: 'night-snack',   label: 'Night Snack'    },
] as const;

/* ------------------------------------------------------------------ */
/*  MealPreviewModal sub-component                                     */
/* ------------------------------------------------------------------ */

function MealPreviewModal({ slot, items, phase, onAdd, onClose, submitting }: {
  slot: string;
  items: MealRow[];
  phase: string;
  onAdd: () => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const title = MEAL_SLOTS.find((s) => s.id === slot)?.label ?? slot;
  const total = items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein:  acc.protein  + i.protein,
      carbs:    acc.carbs    + i.carbs,
      fat:      acc.fat      + i.fat,
      co2ekg:   acc.co2ekg   + i.co2ekg,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, co2ekg: 0 },
  );

  return (
    <div className="meal-modal-overlay" onClick={onClose}>
      <div className="meal-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="meal-modal-title">{title}</h3>
        {items.length === 0 ? (
          <p className="meal-modal-empty">
            No items configured for {phaseLabel(phase)} {title.toLowerCase()}. Add them to the Meals sheet.
          </p>
        ) : (
          <>
            <div className="meal-modal-items">
              {items.map((item, i) => (
                <div key={i} className="meal-modal-item">
                  • {item.item} — {Math.round(item.calories)} cal | {Math.round(item.protein)}g P | {Math.round(item.carbs)}g C | {Math.round(item.fat)}g F
                </div>
              ))}
            </div>
            <div className="meal-modal-divider" />
            <div className="meal-modal-total">
              Total: {Math.round(total.calories)} cal | {Math.round(total.protein)}g P | {Math.round(total.carbs)}g C | {Math.round(total.fat)}g F | {total.co2ekg.toFixed(2)} kg CO₂e
            </div>
          </>
        )}
        <div className="meal-modal-actions">
          {items.length > 0 && (
            <button className="meal-modal-btn-add" onClick={onAdd} disabled={submitting}>
              {submitting ? <Loader size={15} className="spin" /> : 'Add to Log'}
            </button>
          )}
          <button className="nutr-btn-ghost" onClick={onClose}>
            {items.length === 0 ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

const BEER_MACROS    = { type: 'beer',     description: '', protein: 2, carbs: 20, fat: 0, calories: 250, co2ekg: 0.5 };
const COCKTAIL_MACROS = { type: 'cocktail', description: '', protein: 0, carbs: 15, fat: 0, calories: 175, co2ekg: 0.3 };
const NORMAL_PROTEIN  = 220;
const FASTING_PROTEIN = 150;

let _idCounter = 0;
function nextLocalId() { return `n-${++_idCounter}`; }

function parseNutritionRow(r: Record<string, string>): NutritionEntry {
  return {
    localId: nextLocalId(),
    date: String(r['date'] ?? '').trim().slice(0, 10),
    type: String(r['type'] ?? '').trim(),
    description: String(r['description'] ?? '').trim(),
    protein: Number(r['protein'] ?? 0),
    carbs: Number(r['carbs'] ?? 0),
    fat: Number(r['fat'] ?? 0),
    calories: Number(r['calories'] ?? 0),
    co2ekg: Number(r['co2ekg'] ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/*  Phase color helpers                                                */
/* ------------------------------------------------------------------ */

const isCutPhase = (phase: string) =>
  ['cut-aggressive', 'cut-normal', 'maintenance'].includes(phase);

const getNetColor = (net: number, phase: string): string => {
  if (isCutPhase(phase)) return net <= 0 ? '#39ff14' : '#ff1493';
  return net >= 0 ? '#39ff14' : '#ff1493';
};

const getMacroColor = (actual: number, target: number, phase: string, isProtein: boolean): string => {
  if (isProtein) return actual >= target ? '#39ff14' : '#ff1493';
  if (isCutPhase(phase)) return actual <= target ? '#39ff14' : '#ff1493';
  return actual >= target ? '#39ff14' : '#ff1493';
};

/* ------------------------------------------------------------------ */
/*  MacroBar sub-component                                             */
/* ------------------------------------------------------------------ */

function MacroBar({ label, logged, target, unit, fasting, phase, isProtein }: {
  label: string; logged: number; target: number | null; unit: string;
  fasting?: boolean; phase?: string; isProtein?: boolean;
}) {
  const pct = target !== null && target > 0 ? Math.min(100, (logged / target) * 100) : 0;
  const phaseColor = !fasting && phase && target !== null
    ? getMacroColor(logged, target, phase, isProtein ?? false)
    : undefined;
  return (
    <div className="nutr-bar-row">
      <div className="nutr-bar-header">
        <span className="nutr-bar-label">{label}</span>
        <span className="nutr-bar-values" style={phaseColor ? { color: phaseColor } : undefined}>
          {Math.round(logged)}{target !== null ? ` / ${target} ${unit}` : ` ${unit}`}
        </span>
      </div>
      <div className="nutr-bar-track">
        <div
          className={fasting ? 'nutr-bar-fill nutr-bar-fill--fasting' : 'nutr-bar-fill'}
          style={{ width: `${pct}%`, ...(phaseColor ? { background: phaseColor } : {}) }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function NutritionPage({ initialDate, meals = [] }: Props) {
  const [selectedDate, setSelectedDate] = useState(initialDate ?? todayStr());

  // Static data + all nutrition entries — loaded once on mount
  const [staples, setStaples] = useState<StaplesRow[]>([]);
  const [bodyWeight, setBodyWeight] = useState<number | null>(null);
  const [allEntries, setAllEntries] = useState<NutritionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFasting, setIsFasting] = useState(false);
  const [calsBurned, setCalsBurned] = useState('');
  const [weekRollupOpen, setWeekRollupOpen] = useState(false);
  const [weekBurnedMap, setWeekBurnedMap] = useState<Map<string, number>>(new Map());

  const [showStapleConfirm, setShowStapleConfirm] = useState(false);
  const [showMiscForm, setShowMiscForm] = useState(false);
  const [miscFormType, setMiscFormType] = useState<string>('misc');
  const [mealModal, setMealModal] = useState<{ slot: string; items: MealRow[] } | null>(null);
  const [mealSubmitting, setMealSubmitting] = useState(false);
  const [miscDesc, setMiscDesc] = useState('');
  const [miscCalories, setMiscCalories] = useState('');
  const [miscProtein, setMiscProtein] = useState('');
  const [miscCarbs, setMiscCarbs] = useState('');
  const [miscFat, setMiscFat] = useState('');
  const [miscCo2, setMiscCo2] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Profile from localStorage
  const phase    = lsGet('stronger_phase', 'maintenance');
  const ageNum   = parseInt(lsGet('stronger_age', ''), 10);
  const ftNum    = parseInt(lsGet('stronger_height_ft', ''), 10);
  const inNum    = parseInt(lsGet('stronger_height_in', ''), 10);
  const sex: 'male' | 'female' = lsGet('stronger_sex', 'male') === 'female' ? 'female' : 'male';
  const actMult  = parseFloat(lsGet('stronger_activity_level', '1.55'));

  // Stable week dates
  const weekDates = useMemo(() => getWeekDates(), []);

  // ── Load everything once on mount ────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      readSheet<Record<string, string>>('Staples'),
      readSheet<Record<string, string>>('Body Stats'),
      readSheet<Record<string, string>>('Nutrition'),
    ])
      .then(([staplesRows, bodyStatsRows, nutritionRows]) => {
        setStaples(staplesRows.map((r) => ({
          phase: String(r['phase'] ?? '').trim(),
          calorieOffset: Number(r['calorieOffset'] ?? 0),
          fatPct: Number(r['fatPct'] ?? 30),
          co2ekg: Number(r['co2ekg'] ?? 0),
          useBMR: String(r['useBMR'] ?? '').trim().toUpperCase() === 'TRUE',
        })));

        const sorted = [...bodyStatsRows]
          .filter((r) => r['date'])
          .sort((a, b) => b['date'].localeCompare(a['date']));
        if (sorted.length > 0) {
          const w = Number(sorted[0]['bodyWeight'] ?? 0);
          if (w > 0) setBodyWeight(w);
        }

        setAllEntries(nutritionRows.map(parseNutritionRow).filter((e) => e.date));
      })
      .catch(() => { /* sheets may not exist yet */ })
      .finally(() => setLoading(false));
  }, []);

  // ── Sync calsBurned from localStorage when date changes ──────────────────
  useEffect(() => {
    setCalsBurned(lsGet(`stronger_cal_burned_${selectedDate}`, ''));
  }, [selectedDate]);

  // ── Sync weekly burned map when calsBurned or date changes ───────────────
  useEffect(() => {
    const map = new Map<string, number>();
    for (const d of weekDates) {
      const v = Number(lsGet(`stronger_cal_burned_${d}`, '')) || 0;
      if (v > 0) map.set(d, v);
    }
    setWeekBurnedMap(map);
  }, [weekDates, calsBurned]);

  // ── Derive current-day entries from allEntries ────────────────────────────
  const entries = useMemo(
    () => allEntries.filter((e) => e.date === selectedDate),
    [allEntries, selectedDate],
  );

  // Meal slots list (excludes Dinner which has its own button)
  const mealListSlots = MEAL_SLOTS.filter((s) => s.id !== 'dinner');

  // Which meal types are already logged for the selected date
  const loggedMealTypes = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) s.add(e.type);
    return s;
  }, [entries]);

  // ── Normal phase targets ──────────────────────────────────────────────────
  const matchedStaple = staples.find((s) => normalizePhase(s.phase) === normalizePhase(phase)) ?? null;

  const bmr = bodyWeight !== null && !isNaN(ageNum) && ageNum > 0 && !isNaN(ftNum) && !isNaN(inNum)
    ? computeBMR(bodyWeight, ftNum, inNum, ageNum, sex)
    : null;
  const tdee = bmr !== null && !isNaN(actMult) ? bmr * actMult : null;

  const targetCalories = tdee !== null && matchedStaple
    ? Math.round(tdee + matchedStaple.calorieOffset) : null;
  const targetFat = targetCalories !== null && matchedStaple
    ? Math.round((targetCalories * matchedStaple.fatPct / 100) / 9) : null;
  const targetCarbs = targetCalories !== null && targetFat !== null
    ? Math.max(0, Math.round((targetCalories - NORMAL_PROTEIN * 4 - targetFat * 9) / 4)) : null;

  // ── Fasting targets ───────────────────────────────────────────────────────
  const fastingStaple = staples.find((s) => normalizePhase(s.phase) === 'fasting') ?? null;
  const fastingBase = fastingStaple !== null ? (fastingStaple.useBMR ? bmr : tdee) : null;
  const fastingCalories = fastingBase !== null && fastingStaple !== null
    ? Math.round(fastingBase + fastingStaple.calorieOffset) : null;
  const fastingFat = fastingCalories !== null && fastingStaple !== null
    ? Math.round((fastingCalories * fastingStaple.fatPct / 100) / 9) : null;
  const fastingCarbs = fastingCalories !== null && fastingFat !== null
    ? Math.max(0, Math.round((fastingCalories - FASTING_PROTEIN * 4 - fastingFat * 9) / 4)) : null;

  // ── Active targets ────────────────────────────────────────────────────────
  const activeStaple   = isFasting ? fastingStaple   : matchedStaple;
  const activeCalories = isFasting ? fastingCalories : targetCalories;
  const activeProtein  = isFasting ? FASTING_PROTEIN  : NORMAL_PROTEIN;
  const activeFat      = isFasting ? fastingFat       : targetFat;
  const activeCarbs    = isFasting ? fastingCarbs     : targetCarbs;

  // ── Daily totals ──────────────────────────────────────────────────────────
  const loggedCalories = entries.reduce((s, e) => s + e.calories, 0);
  const loggedProtein  = entries.reduce((s, e) => s + e.protein, 0);
  const loggedCarbs    = entries.reduce((s, e) => s + e.carbs, 0);
  const loggedFat      = entries.reduce((s, e) => s + e.fat, 0);
  const loggedCo2      = entries.reduce((s, e) => s + e.co2ekg, 0);

  const calsBurnedNum = Number(calsBurned) || 0;
  const netCalories   = loggedCalories - calsBurnedNum;
  const dailyStatus   = netStatus(netCalories, activeCalories);

  // ── Weekly rollup ─────────────────────────────────────────────────────────
  const weekData = useMemo(() => {
    return weekDates.map((date) => {
      const dayEntries = allEntries.filter((e) => e.date === date);
      const consumed = dayEntries.reduce((s, e) => s + e.calories, 0);
      const burned   = weekBurnedMap.get(date) ?? 0;
      const net      = consumed - burned;
      const hasData  = dayEntries.length > 0 || burned > 0;
      return { date, consumed, burned, net, hasData };
    });
  }, [weekDates, allEntries, weekBurnedMap]);

  const weekTotals = useMemo(() => {
    const consumed = weekData.reduce((s, d) => s + d.consumed, 0);
    const burned   = weekData.reduce((s, d) => s + d.burned, 0);
    const net      = consumed - burned;
    const daysWithData = weekData.filter((d) => d.hasData).length;
    return { consumed, burned, net, avgNet: daysWithData > 0 ? Math.round(net / daysWithData) : null };
  }, [weekData]);

  // ── Save helper ───────────────────────────────────────────────────────────
  async function persistEntry(entry: Omit<NutritionEntry, 'localId'>) {
    const newEntry = { ...entry, localId: nextLocalId() };
    setAllEntries((prev) => [...prev, newEntry]);
    await appendRow('Nutrition', {
      date: entry.date, type: entry.type, description: entry.description,
      protein: entry.protein, carbs: entry.carbs, fat: entry.fat,
      calories: entry.calories, co2ekg: entry.co2ekg,
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddBeer = useCallback(async () => {
    setSubmitting(true);
    try { await persistEntry({ ...BEER_MACROS, date: selectedDate }); }
    finally { setSubmitting(false); }
  }, [selectedDate]);

  const handleAddCocktail = useCallback(async () => {
    setSubmitting(true);
    try { await persistEntry({ ...COCKTAIL_MACROS, date: selectedDate }); }
    finally { setSubmitting(false); }
  }, [selectedDate]);

  const handleConfirmStaple = useCallback(async () => {
    const staple = isFasting ? fastingStaple : matchedStaple;
    const cal    = isFasting ? fastingCalories : targetCalories;
    const fat    = isFasting ? fastingFat : targetFat;
    const carbs  = isFasting ? fastingCarbs : targetCarbs;
    const prot   = isFasting ? FASTING_PROTEIN : NORMAL_PROTEIN;
    if (!staple || cal === null || fat === null || carbs === null) return;
    setSubmitting(true);
    try {
      await persistEntry({ date: selectedDate, type: 'staple', description: '', protein: prot, carbs, fat, calories: cal, co2ekg: staple.co2ekg });
      setShowStapleConfirm(false);
    } finally { setSubmitting(false); }
  }, [isFasting, fastingStaple, matchedStaple, fastingCalories, fastingFat, fastingCarbs, targetCalories, targetFat, targetCarbs, selectedDate]);

  const handleMiscSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const cal = Number(miscCalories);
    if (miscCalories === '' || isNaN(cal)) return;
    setSubmitting(true);
    try {
      await persistEntry({
        date: selectedDate, type: miscFormType, description: miscDesc,
        protein: Number(miscProtein) || 0, carbs: Number(miscCarbs) || 0,
        fat: Number(miscFat) || 0, calories: cal, co2ekg: Number(miscCo2) || 0,
      });
      setShowMiscForm(false);
      setMiscDesc(''); setMiscCalories(''); setMiscProtein(''); setMiscCarbs(''); setMiscFat(''); setMiscCo2('');
    } finally { setSubmitting(false); }
  }, [selectedDate, miscFormType, miscDesc, miscCalories, miscProtein, miscCarbs, miscFat, miscCo2]);

  const handleAddMeal = useCallback(async () => {
    if (!mealModal || mealModal.items.length === 0) return;
    const mealSlot = mealModal.slot; // e.g. 'morning-snack', 'lunch', 'pre-workout'
    const total = mealModal.items.reduce(
      (acc, i) => ({
        calories: acc.calories + i.calories, protein: acc.protein + i.protein,
        carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat, co2ekg: acc.co2ekg + i.co2ekg,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, co2ekg: 0 },
    );
    console.log('[meal] logging', { date: selectedDate, type: mealSlot, total });
    setMealSubmitting(true);
    try {
      await persistEntry({ date: selectedDate, type: mealSlot, description: '', ...total });
      setMealModal(null);
    } finally { setMealSubmitting(false); }
  }, [mealModal, selectedDate]);

  const handleMealButtonClick = useCallback((slotId: string) => {
    setShowStapleConfirm(false);
    if (slotId === 'dinner') {
      setMiscFormType('dinner');
      setMiscDesc('Dinner');
      setShowMiscForm(true);
      setMealModal(null);
      return;
    }
    const items = meals.filter((m) => m.phase === phase && m.meal === slotId);
    console.log('[meals] filtering', { activePhase: phase, mealSlot: slotId, totalRows: meals.length, matched: items.length });
    setMealModal({ slot: slotId, items });
    setShowMiscForm(false);
  }, [phase, meals]);

  const handleDelete = useCallback(async (localId: string) => {
    const updated = allEntries.filter((e) => e.localId !== localId);
    setAllEntries(updated);
    const rows = updated.map((e) => ({
      date: e.date, type: e.type, description: e.description,
      protein: e.protein, carbs: e.carbs, fat: e.fat,
      calories: e.calories, co2ekg: e.co2ekg,
    }));
    await writeSheet('Nutrition', rows);
  }, [allEntries]);

  const handleCalsBurnedChange = (val: string) => {
    setCalsBurned(val);
    lsSet(`stronger_cal_burned_${selectedDate}`, val);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="nutr-loading"><Loader size={24} className="spin" /></div>;
  }

  const confirmLabel = isFasting ? 'Add Staple — Fasting' : `Add Staple — ${phaseLabel(phase)}`;

  const statusClass: Record<NetStatus, string> = {
    ok:   'nutr-net--ok',
    over: 'nutr-net--over',
    under:'nutr-net--under',
    none: '',
  };
  const statusIcon: Record<NetStatus, string> = {
    ok:   '✓',
    over: '▲',
    under:'▼',
    none: '',
  };

  return (
    <div className="nutr-page">
      <h2 className="nutr-title">Nutrition</h2>

      {/* Date navigator */}
      <div className="nutr-date-nav">
        <button className="nutr-date-arrow" onClick={() => setSelectedDate((d) => addDays(d, -1))} aria-label="Previous day">
          <ChevronLeft size={20} />
        </button>
        <span className="nutr-date-label">{formatDisplayDate(selectedDate)}</span>
        <button className="nutr-date-arrow" onClick={() => setSelectedDate((d) => addDays(d, 1))} aria-label="Next day">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Fasting toggle */}
      <label className={`nutr-fasting-row${isFasting ? ' nutr-fasting-row--active' : ''}`}>
        <span className={`nutr-fasting-label${isFasting ? ' nutr-fasting-label--active' : ''}`}>Fasting Day</span>
        <input type="checkbox" className="settings-toggle-input" checked={isFasting} onChange={(e) => setIsFasting(e.target.checked)} />
        <span className={`settings-toggle-switch${isFasting ? ' nutr-fasting-switch' : ''}`} />
      </label>

      {/* Macro targets card */}
      <div className={`nutr-card${isFasting ? ' nutr-card--fasting' : ''}`}>
        <div className={`nutr-phase-label${isFasting ? ' nutr-phase-label--fasting' : ''}`}>
          {isFasting ? 'Fasting' : phaseLabel(phase)}
        </div>
        <MacroBar label="Calories" logged={loggedCalories} target={activeCalories} unit="kcal" fasting={isFasting} phase={phase} />
        <MacroBar label="Protein"  logged={loggedProtein}  target={activeProtein}  unit="g"    fasting={isFasting} phase={phase} isProtein />
        <MacroBar label="Carbs"    logged={loggedCarbs}    target={activeCarbs}    unit="g"    fasting={isFasting} phase={phase} />
        <MacroBar label="Fat"      logged={loggedFat}      target={activeFat}      unit="g"    fasting={isFasting} phase={phase} />
        {activeStaple && (
          <div className="nutr-co2-target">
            CO₂e today: {loggedCo2.toFixed(2)} / {activeStaple.co2ekg} kg target
          </div>
        )}
      </div>

      {/* Calories burned input */}
      <div className="nutr-burned-row">
        <label className="nutr-burned-label" htmlFor="nutr-burned-input">Calories Burned Today</label>
        <input
          id="nutr-burned-input"
          type="number"
          min="0"
          step="1"
          className="nutr-burned-input"
          value={calsBurned}
          onChange={(e) => handleCalsBurnedChange(e.target.value)}
          placeholder="0"
        />
      </div>

      {/* Daily summary card */}
      {(() => {
        const netColor = !isFasting ? getNetColor(netCalories, phase) : undefined;
        const isCut = isCutPhase(phase);
        const isGood = isCut ? netCalories <= 0 : netCalories >= 0;

        let indicatorText = '';
        if (activeCalories !== null) {
          const diff = Math.round(netCalories - activeCalories);
          const absDiff = Math.abs(diff);
          if (absDiff <= 100) {
            indicatorText = 'on track';
          } else if (netCalories < 0 || diff < 0) {
            indicatorText = `▼ ${absDiff} kcal deficit ${isGood ? '✓' : '✗'}`;
          } else {
            indicatorText = `▲ ${absDiff} kcal surplus ${isGood ? '✓' : '✗'}`;
          }
        }

        return (
          <div className="nutr-summary-card">
            <div className="nutr-summary-row">
              <span className="nutr-summary-key">Consumed</span>
              <span className="nutr-summary-val">{Math.round(loggedCalories)} kcal</span>
            </div>
            <div className="nutr-summary-row">
              <span className="nutr-summary-key">Burned</span>
              <span className="nutr-summary-val">{calsBurnedNum} kcal</span>
            </div>
            <div className="nutr-summary-row nutr-summary-row--net">
              <span className="nutr-summary-key">Net</span>
              <span className="nutr-summary-val" style={netColor ? { color: netColor } : undefined}>
                {Math.round(netCalories)} kcal
              </span>
            </div>
            {activeCalories !== null && (
              <>
                <div className="nutr-summary-divider" />
                <div className="nutr-summary-row">
                  <span className="nutr-summary-key">Target</span>
                  <span className="nutr-summary-val">{activeCalories} kcal</span>
                </div>
                <div className="nutr-summary-row">
                  <span className="nutr-summary-key">Net vs target</span>
                  <span className="nutr-summary-val" style={netColor ? { color: netColor } : undefined}>
                    {indicatorText}
                  </span>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Daily log */}
      <div className="nutr-log-section">
        <h3 className="nutr-log-title">Today's Log</h3>
        {entries.length === 0 ? (
          <p className="nutr-empty">Nothing logged yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.localId} className="nutr-entry-card">
              <div className="nutr-entry-header">
                <span className="nutr-entry-type">
                  {(entry.type || 'misc').replace(/-/g, ' ')}
                </span>
                {entry.description && <span className="nutr-entry-desc">{entry.description}</span>}
                <button className="nutr-entry-delete" onClick={() => handleDelete(entry.localId)} aria-label="Remove entry">
                  <X size={14} />
                </button>
              </div>
              <div className="nutr-entry-macros">
                <span>P: {Math.round(entry.protein)}g</span>
                <span>C: {Math.round(entry.carbs)}g</span>
                <span>F: {Math.round(entry.fat)}g</span>
                <span>{Math.round(entry.calories)} kcal</span>
                <span>CO₂: {entry.co2ekg.toFixed(2)}kg</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Weekly rollup */}
      <div className="nutr-week-section">
        <button className="nutr-week-header" onClick={() => setWeekRollupOpen((o) => !o)}>
          <span className="nutr-week-header-label">This Week</span>
          <ChevronDown size={16} className={weekRollupOpen ? 'nutr-week-chevron nutr-week-chevron--open' : 'nutr-week-chevron'} />
        </button>

        {weekRollupOpen && (
          <div className="nutr-week-body">
            {weekData.map(({ date, consumed, burned, net, hasData }) => {
              const dotColor = hasData ? getNetColor(net, phase) : 'rgba(255,255,255,0.2)';
              const netColor = hasData ? getNetColor(net, phase) : undefined;
              return (
                <div key={date} className="nutr-week-row">
                  <span className="nutr-week-dot" style={{ background: dotColor }} />
                  <span className="nutr-week-day">{formatWeekLabel(date)}</span>
                  <span className="nutr-week-num">{hasData ? `${Math.round(consumed)}` : '—'}</span>
                  <span className="nutr-week-sep">–</span>
                  <span className="nutr-week-num">{burned > 0 ? Math.round(burned) : '—'}</span>
                  <span className="nutr-week-sep">=</span>
                  <span className="nutr-week-num" style={netColor ? { color: netColor } : undefined}>
                    {hasData ? Math.round(net) : '—'}
                  </span>
                </div>
              );
            })}

            <div className="nutr-week-totals">
              <span className="nutr-week-totals-label">Week total</span>
              <span className="nutr-week-num">{Math.round(weekTotals.consumed)}</span>
              <span className="nutr-week-sep">–</span>
              <span className="nutr-week-num">{Math.round(weekTotals.burned)}</span>
              <span className="nutr-week-sep">=</span>
              <span className="nutr-week-num" style={{ color: getNetColor(weekTotals.net, phase) }}>
                {Math.round(weekTotals.net)}
              </span>
            </div>
            {weekTotals.avgNet !== null && (
              <div className="nutr-week-avg">
                Avg daily net: <strong style={{ color: getNetColor(weekTotals.avgNet, phase) }}>{weekTotals.avgNet} kcal</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Misc / Dinner form */}
      {showMiscForm && (
        <form className="nutr-misc-form" onSubmit={handleMiscSubmit}>
          {miscFormType === 'dinner' && <div className="nutr-misc-form-title">Dinner</div>}
          <input
            className="nutr-input nutr-input-full"
            placeholder="Description (optional)"
            value={miscDesc}
            onChange={(e) => setMiscDesc(e.target.value)}
            disabled={miscFormType === 'dinner'}
            readOnly={miscFormType === 'dinner'}
          />
          <div className="nutr-form-field">
            <label className="nutr-form-label">Calories (kcal) *</label>
            <input type="number" step="any" className="nutr-input nutr-input-full" value={miscCalories} onChange={(e) => setMiscCalories(e.target.value)} placeholder="0" required />
          </div>
          <div className="nutr-form-grid">
            <div className="nutr-form-field">
              <label className="nutr-form-label">Protein (g)</label>
              <input type="number" step="any" className="nutr-input" value={miscProtein} onChange={(e) => setMiscProtein(e.target.value)} placeholder="0" />
            </div>
            <div className="nutr-form-field">
              <label className="nutr-form-label">Carbs (g)</label>
              <input type="number" step="any" className="nutr-input" value={miscCarbs} onChange={(e) => setMiscCarbs(e.target.value)} placeholder="0" />
            </div>
            <div className="nutr-form-field">
              <label className="nutr-form-label">Fat (g)</label>
              <input type="number" step="any" className="nutr-input" value={miscFat} onChange={(e) => setMiscFat(e.target.value)} placeholder="0" />
            </div>
            <div className="nutr-form-field">
              <label className="nutr-form-label">CO₂e (kg)</label>
              <input type="number" step="any" className="nutr-input" value={miscCo2} onChange={(e) => setMiscCo2(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="nutr-form-actions">
            <button type="submit" className="nutr-btn" disabled={submitting}>
              {submitting ? <Loader size={15} className="spin" /> : 'Save'}
            </button>
            <button type="button" className="nutr-btn-ghost" onClick={() => setShowMiscForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Staple confirm dialog */}
      {showStapleConfirm && activeStaple && (
        <div className="nutr-confirm-overlay">
          <div className={`nutr-confirm-card${isFasting ? ' nutr-confirm-card--fasting' : ''}`}>
            <h3 className="nutr-confirm-title">{confirmLabel}</h3>
            <div className="nutr-confirm-grid">
              <span>Calories</span><span>{activeCalories ?? '—'} kcal</span>
              <span>Protein</span><span>{activeProtein} g</span>
              <span>Carbs</span><span>{activeCarbs ?? '—'} g</span>
              <span>Fat</span><span>{activeFat ?? '—'} g</span>
              <span>CO₂e</span><span>{activeStaple.co2ekg} kg</span>
            </div>
            <div className="nutr-confirm-actions">
              <button className="nutr-btn" onClick={handleConfirmStaple} disabled={submitting}>
                {submitting ? <Loader size={15} className="spin" /> : 'Confirm'}
              </button>
              <button className="nutr-btn-ghost" onClick={() => setShowStapleConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Carbon Footprint widget */}
      <div className="nutr-co2-card">
        <h3 className="nutr-co2-card-title">Carbon Footprint</h3>
        <div className="nutr-co2-rows">
          <div className="nutr-co2-row">
            <span>Logged CO₂e today</span>
            <span>{loggedCo2.toFixed(2)} kg</span>
          </div>
          <div className="nutr-co2-row">
            <span>Adjusted (est. total)</span>
            <span>~{(loggedCo2 * 1.2).toFixed(2)} kg</span>
          </div>
        </div>
        <div className="nutr-co2-bar-wrap">
          <div className="nutr-co2-bar-track">
            <div
              className={`nutr-co2-bar-fill${loggedCo2 * 1.2 > DAILY_CO2_TARGET ? ' nutr-co2-bar-fill--over' : ''}`}
              style={{ width: `${Math.min(100, (loggedCo2 * 1.2 / DAILY_CO2_TARGET) * 100)}%` }}
            />
          </div>
          {loggedCo2 * 1.2 > DAILY_CO2_TARGET && <span>⚠️</span>}
        </div>
        <p className="nutr-co2-label">Target: {DAILY_CO2_TARGET.toFixed(2)} kg/day (0.75–1.0t/year goal)</p>
      </div>

      {/* Today's Meals card */}
      <div className="meal-list-card">
        <div className="meal-list-title">Today's Meals</div>
        {mealListSlots.map((slot, i) => {
          const isLogged = loggedMealTypes.has(slot.id);
          return (
            <div key={slot.id} className={`meal-list-row${i < mealListSlots.length - 1 ? ' meal-list-row--divider' : ''}`}>
              <span className="meal-list-name">{slot.label}</span>
              {isLogged ? (
                <span className="meal-list-check">✓</span>
              ) : (
                <button
                  className="meal-list-add"
                  onClick={() => handleMealButtonClick(slot.id)}
                  disabled={submitting || mealSubmitting}
                  aria-label={`Add ${slot.label}`}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 2×2 action grid */}
      <div className="nutr-actions-2col">
        <button className="nutr-btn" onClick={() => handleMealButtonClick('dinner')} disabled={submitting || mealSubmitting}>Dinner</button>
        <button className="nutr-btn" onClick={() => { setMiscFormType('misc'); setMiscDesc(''); setShowMiscForm(true); setMealModal(null); }} disabled={submitting}>Add Misc</button>
        <button className="nutr-btn" onClick={handleAddBeer} disabled={submitting}>Add Beer</button>
        <button className="nutr-btn" onClick={handleAddCocktail} disabled={submitting}>Add Cocktail</button>
      </div>

      {/* Meal preview modal */}
      {mealModal && (
        <MealPreviewModal
          slot={mealModal.slot}
          items={mealModal.items}
          phase={phase}
          onAdd={handleAddMeal}
          onClose={() => setMealModal(null)}
          submitting={mealSubmitting}
        />
      )}
    </div>
  );
}
