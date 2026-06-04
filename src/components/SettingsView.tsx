import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, AlertTriangle, Check, Loader, Unlink, Sliders, User, BarChart2, Target, Plus } from 'lucide-react';
import { parseHevyCsv, convertHevyRows, computeImportSummary } from '../model/hevy-import.js';
import { clearSheetId } from '../google/storage.js';
import { readSheet, appendRow } from '../google/api.js';
import type { ImportSummary } from '../model/hevy-import.js';
import type { AppSettings } from '../model/index.js';

interface Props {
  spreadsheetId: string;
  onImportComplete: () => void;
  appendLogRows: (spreadsheetId: string, rows: (string | number | boolean)[][]) => Promise<void>;
  onDisconnectSheet: () => void;
  appSettings: AppSettings;
  onAppSettingChange: (key: keyof AppSettings, value: boolean) => void;
}

type ImportPhase = 'idle' | 'preview' | 'importing' | 'done' | 'error';

interface BodyStatEntry {
  date: string;
  bodyWeight: number;
  bodyFat: number;
  subcutaneousFat: number;
  fatFreeMass: number;
}

function computeBMR(
  weightLbs: number,
  heightFt: number,
  heightIn: number,
  age: number,
  sex: 'male' | 'female',
): number {
  const kg = weightLbs / 2.205;
  const cm = (heightFt * 12 + heightIn) * 2.54;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

function lsGet(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function SettingsView({ spreadsheetId, onImportComplete, appendLogRows, onDisconnectSheet, appSettings, onAppSettingChange }: Props) {
  // ── Existing import state ──────────────────────────────────────────────────
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [convertedRows, setConvertedRows] = useState<(string | number | boolean)[][] | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Personal profile (localStorage) ───────────────────────────────────────
  const [age, setAge] = useState(() => lsGet('stronger_age', ''));
  const [heightFt, setHeightFt] = useState(() => lsGet('stronger_height_ft', ''));
  const [heightIn, setHeightIn] = useState(() => lsGet('stronger_height_in', ''));
  const [sex, setSex] = useState<'male' | 'female'>(() =>
    lsGet('stronger_sex', 'male') === 'female' ? 'female' : 'male',
  );
  const [activityLevel, setActivityLevel] = useState(() => lsGet('stronger_activity_level', '1.55'));
  const [activePhase, setActivePhase] = useState(() => lsGet('stronger_phase', 'maintenance'));

  // ── Body stats ─────────────────────────────────────────────────────────────
  const [bodyStats, setBodyStats] = useState<BodyStatEntry[]>([]);
  const [bodyStatsLoading, setBodyStatsLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logWeight, setLogWeight] = useState('');
  const [logBodyFat, setLogBodyFat] = useState('');
  const [logSubcut, setLogSubcut] = useState('');
  const [logFfm, setLogFfm] = useState('');
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  // ── Goals (localStorage) ───────────────────────────────────────────────────
  const [goalBf, setGoalBf] = useState(() => lsGet('stronger_goal_bf', ''));
  const [goalWeight, setGoalWeight] = useState(() => lsGet('stronger_goal_weight', ''));

  // ── Load body stats on mount ───────────────────────────────────────────────
  useEffect(() => {
    readSheet<Record<string, string>>('Body Stats')
      .then((rows) => {
        const entries: BodyStatEntry[] = rows
          .map((r) => ({
            date: r['date'] ?? '',
            bodyWeight: Number(r['bodyWeight'] ?? 0),
            bodyFat: Number(r['bodyFat'] ?? 0),
            subcutaneousFat: Number(r['subcutaneousFat'] ?? 0),
            fatFreeMass: Number(r['fatFreeMass'] ?? 0),
          }))
          .filter((e) => e.date);
        entries.sort((a, b) => b.date.localeCompare(a.date));
        setBodyStats(entries);
      })
      .catch(() => { /* no-op — sheet may not exist yet */ })
      .finally(() => setBodyStatsLoading(false));
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const latestStats = bodyStats.length > 0 ? bodyStats[0] : null;

  const ageNum = parseInt(age, 10);
  const ftNum = parseInt(heightFt, 10);
  const inNum = parseInt(heightIn, 10);
  const bmr =
    latestStats && !isNaN(ageNum) && ageNum > 0 && !isNaN(ftNum) && !isNaN(inNum)
      ? computeBMR(latestStats.bodyWeight, ftNum, inNum, ageNum, sex)
      : null;
  const actMult = parseFloat(activityLevel);
  const tdee = bmr !== null && !isNaN(actMult) ? bmr * actMult : null;

  const goalBfNum = parseFloat(goalBf);
  const goalWeightNum = parseFloat(goalWeight);
  const calculatedFfm =
    !isNaN(goalWeightNum) && goalWeightNum > 0 && !isNaN(goalBfNum) && goalBfNum > 0
      ? goalWeightNum * (1 - goalBfNum / 100)
      : null;

  const bfProgress =
    latestStats && !isNaN(goalBfNum) && goalBfNum > 0
      ? latestStats.bodyFat <= goalBfNum
        ? 100
        : Math.min(100, (goalBfNum / latestStats.bodyFat) * 100)
      : null;

  const weightProgress =
    latestStats && !isNaN(goalWeightNum) && goalWeightNum > 0
      ? Math.min(100, (latestStats.bodyWeight / goalWeightNum) * 100)
      : null;

  const ffmProgress =
    latestStats && calculatedFfm !== null
      ? Math.min(100, (latestStats.fatFreeMass / calculatedFfm) * 100)
      : null;

  // ── Existing handlers ──────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const text = await file.text();
      const hevyRows = parseHevyCsv(text);
      if (hevyRows.length === 0) { setError('No data rows found in the CSV file.'); return; }
      const rows = convertHevyRows(hevyRows);
      const importSummary = computeImportSummary(hevyRows);
      setConvertedRows(rows);
      setSummary(importSummary);
      setPhase('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
      setPhase('error');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!convertedRows || convertedRows.length === 0) return;
    try {
      setPhase('importing');
      setError(null);
      await appendLogRows(spreadsheetId, convertedRows);
      setImportedCount(convertedRows.length);
      setPhase('done');
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to write to Google Sheet.');
      setPhase('error');
    }
  }, [convertedRows, spreadsheetId, appendLogRows, onImportComplete]);

  const handleReset = useCallback(() => {
    setPhase('idle');
    setSummary(null);
    setConvertedRows(null);
    setImportedCount(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Log stats handler ──────────────────────────────────────────────────────
  const handleLogSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError(null);
    setLogSubmitting(true);
    try {
      await appendRow('Body Stats', {
        date: logDate,
        bodyWeight: logWeight,
        bodyFat: logBodyFat,
        subcutaneousFat: logSubcut,
        fatFreeMass: logFfm,
      });
      const entry: BodyStatEntry = {
        date: logDate,
        bodyWeight: Number(logWeight),
        bodyFat: Number(logBodyFat),
        subcutaneousFat: Number(logSubcut),
        fatFreeMass: Number(logFfm),
      };
      setBodyStats((prev) => [entry, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      setShowLogForm(false);
      setLogWeight('');
      setLogBodyFat('');
      setLogSubcut('');
      setLogFfm('');
      setLogDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Failed to save stats.');
    } finally {
      setLogSubmitting(false);
    }
  }, [logDate, logWeight, logBodyFat, logSubcut, logFfm]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="settings-view">
      <h2 className="settings-title">Settings</h2>

      {/* ── Workout Preferences ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          <Sliders size={18} />
          Workout Preferences
        </h3>

        <label className="settings-toggle-row">
          <span className="settings-toggle-label">
            <span className="settings-toggle-name">Rest Timer</span>
            <span className="settings-toggle-description">Show a count-up timer between sets</span>
          </span>
          <input
            type="checkbox"
            className="settings-toggle-input"
            checked={appSettings.showRestTimer}
            onChange={(e) => onAppSettingChange('showRestTimer', e.target.checked)}
          />
          <span className="settings-toggle-switch" />
        </label>

        <label className="settings-toggle-row">
          <span className="settings-toggle-label">
            <span className="settings-toggle-name">Set Comments</span>
            <span className="settings-toggle-description">Show rep ranges and notes on sets</span>
          </span>
          <input
            type="checkbox"
            className="settings-toggle-input"
            checked={appSettings.showSetComments}
            onChange={(e) => onAppSettingChange('showSetComments', e.target.checked)}
          />
          <span className="settings-toggle-switch" />
        </label>

        <label className="settings-toggle-row">
          <span className="settings-toggle-label">
            <span className="settings-toggle-name">Keep Screen On</span>
            <span className="settings-toggle-description">Prevent the screen from sleeping during workouts</span>
          </span>
          <input
            type="checkbox"
            className="settings-toggle-input"
            checked={appSettings.keepScreenOn}
            onChange={(e) => onAppSettingChange('keepScreenOn', e.target.checked)}
          />
          <span className="settings-toggle-switch" />
        </label>
      </div>

      {/* ── Personal Profile ── */}
      <div className="settings-section" style={{ marginTop: '1.5rem' }}>
        <h3 className="settings-section-title">
          <User size={18} />
          Personal Profile
        </h3>

        <div className="settings-field-row">
          <span className="settings-toggle-name">Age</span>
          <input
            type="number"
            min={1}
            max={120}
            className="settings-num-input"
            value={age}
            onChange={(e) => { setAge(e.target.value); lsSet('stronger_age', e.target.value); }}
            placeholder="—"
          />
        </div>

        <div className="settings-field-row">
          <span className="settings-toggle-name">Height</span>
          <div className="settings-height-row">
            <input
              type="number"
              min={0}
              max={9}
              className="settings-num-input"
              value={heightFt}
              onChange={(e) => { setHeightFt(e.target.value); lsSet('stronger_height_ft', e.target.value); }}
              placeholder="—"
            />
            <span>ft</span>
            <input
              type="number"
              min={0}
              max={11}
              className="settings-num-input"
              value={heightIn}
              onChange={(e) => { setHeightIn(e.target.value); lsSet('stronger_height_in', e.target.value); }}
              placeholder="—"
            />
            <span>in</span>
          </div>
        </div>

        <div className="settings-field-row">
          <span className="settings-toggle-name">Sex</span>
          <div className="settings-seg-toggle">
            <button
              type="button"
              className={`settings-seg-btn${sex === 'male' ? ' settings-seg-active' : ''}`}
              onClick={() => { setSex('male'); lsSet('stronger_sex', 'male'); }}
            >
              Male
            </button>
            <button
              type="button"
              className={`settings-seg-btn${sex === 'female' ? ' settings-seg-active' : ''}`}
              onClick={() => { setSex('female'); lsSet('stronger_sex', 'female'); }}
            >
              Female
            </button>
          </div>
        </div>

        <div className="settings-field-row">
          <span className="settings-toggle-name">Activity Level</span>
          <select
            className="settings-field-select"
            value={activityLevel}
            onChange={(e) => { setActivityLevel(e.target.value); lsSet('stronger_activity_level', e.target.value); }}
          >
            <option value="1.2">Sedentary</option>
            <option value="1.375">Lightly Active</option>
            <option value="1.55">Moderately Active</option>
            <option value="1.725">Very Active</option>
          </select>
        </div>

        <div className="settings-field-row">
          <span className="settings-toggle-name">Active Phase</span>
          <select
            className="settings-field-select"
            value={activePhase}
            onChange={(e) => { setActivePhase(e.target.value); lsSet('stronger_phase', e.target.value); }}
          >
            <option value="bulk-aggressive">Bulk Aggressive</option>
            <option value="bulk-normal">Bulk Normal</option>
            <option value="cut-aggressive">Cut Aggressive</option>
            <option value="cut-normal">Cut Normal</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {/* ── Body Stats ── */}
      <div className="settings-section" style={{ marginTop: '1.5rem' }}>
        <h3 className="settings-section-title">
          <BarChart2 size={18} />
          Body Stats
        </h3>

        {bodyStatsLoading ? (
          <p className="settings-toggle-description">Loading…</p>
        ) : latestStats ? (
          <>
            <span className="settings-stat-date">Last updated: {new Date(latestStats.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <div className="settings-preview-grid">
              <div className="settings-preview-item">
                <span className="settings-preview-label">Body Weight</span>
                <span className="settings-preview-value">{latestStats.bodyWeight} lbs</span>
              </div>
              <div className="settings-preview-item">
                <span className="settings-preview-label">Body Fat</span>
                <span className="settings-preview-value">{latestStats.bodyFat}%</span>
              </div>
              <div className="settings-preview-item">
                <span className="settings-preview-label">Subcut. Fat</span>
                <span className="settings-preview-value">{latestStats.subcutaneousFat}%</span>
              </div>
              <div className="settings-preview-item">
                <span className="settings-preview-label">Fat Free Mass</span>
                <span className="settings-preview-value">{latestStats.fatFreeMass} lbs</span>
              </div>
              <div className="settings-preview-item">
                <span className="settings-preview-label">BMR</span>
                <span className="settings-preview-value">
                  {bmr !== null ? `${Math.round(bmr)} kcal` : '—'}
                </span>
              </div>
              <div className="settings-preview-item">
                <span className="settings-preview-label">TDEE</span>
                <span className="settings-preview-value">
                  {tdee !== null ? `${Math.round(tdee)} kcal` : '—'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="settings-toggle-description" style={{ marginBottom: '0.75rem' }}>
            No entries yet.
          </p>
        )}

        {!showLogForm ? (
          <button
            type="button"
            className="settings-log-open-btn"
            onClick={() => setShowLogForm(true)}
          >
            <Plus size={15} />
            Log New Stats
          </button>
        ) : (
          <form className="settings-log-form" onSubmit={handleLogSubmit}>
            <div className="settings-log-field">
              <label className="settings-log-label">Date</label>
              <input
                type="date"
                className="settings-log-input"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                required
              />
            </div>
            <div className="settings-log-field">
              <label className="settings-log-label">Body Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="settings-log-input"
                value={logWeight}
                onChange={(e) => setLogWeight(e.target.value)}
                placeholder="0.0"
                required
              />
            </div>
            <div className="settings-log-field">
              <label className="settings-log-label">Body Fat %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="settings-log-input"
                value={logBodyFat}
                onChange={(e) => setLogBodyFat(e.target.value)}
                placeholder="0.0"
                required
              />
            </div>
            <div className="settings-log-field">
              <label className="settings-log-label">Subcutaneous Fat %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="settings-log-input"
                value={logSubcut}
                onChange={(e) => setLogSubcut(e.target.value)}
                placeholder="0.0"
                required
              />
            </div>
            <div className="settings-log-field">
              <label className="settings-log-label">Fat Free Mass (lbs)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="settings-log-input"
                value={logFfm}
                onChange={(e) => setLogFfm(e.target.value)}
                placeholder="0.0"
                required
              />
            </div>
            {logError && <p className="settings-error">{logError}</p>}
            <div className="settings-log-actions">
              <button type="submit" className="btn-primary" disabled={logSubmitting} style={{ flex: 1, fontSize: '0.9rem', minHeight: 40 }}>
                {logSubmitting ? <Loader size={16} className="settings-spinner" /> : 'Save'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setShowLogForm(false); setLogError(null); }} style={{ fontSize: '0.9rem', minHeight: 40 }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Goals ── */}
      <div className="settings-section" style={{ marginTop: '1.5rem' }}>
        <h3 className="settings-section-title">
          <Target size={18} />
          Goals
        </h3>

        {/* Target body fat % */}
        <div className="settings-goal-row">
          <div className="settings-goal-header">
            <span className="settings-toggle-name">Target Body Fat %</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="settings-num-input"
              value={goalBf}
              onChange={(e) => { setGoalBf(e.target.value); lsSet('stronger_goal_bf', e.target.value); }}
              placeholder="—"
            />
          </div>
          {bfProgress !== null && (
            <>
              <div className="settings-goal-bar-track">
                <div className="settings-goal-bar-fill" style={{ width: `${bfProgress}%` }} />
              </div>
              <span className="settings-goal-caption">
                Current {latestStats!.bodyFat}% → Goal {goalBf}%
              </span>
            </>
          )}
        </div>

        {/* Target body weight */}
        <div className="settings-goal-row">
          <div className="settings-goal-header">
            <span className="settings-toggle-name">Target Body Weight (lbs)</span>
            <input
              type="number"
              step="0.5"
              min="0"
              className="settings-num-input"
              value={goalWeight}
              onChange={(e) => { setGoalWeight(e.target.value); lsSet('stronger_goal_weight', e.target.value); }}
              placeholder="—"
            />
          </div>
          {weightProgress !== null && (
            <>
              <div className="settings-goal-bar-track">
                <div className="settings-goal-bar-fill" style={{ width: `${weightProgress}%` }} />
              </div>
              <span className="settings-goal-caption">
                Current {latestStats!.bodyWeight} lbs → Goal {goalWeight} lbs
              </span>
            </>
          )}
        </div>

        {/* Target fat free mass — calculated from weight × (1 − BF%) */}
        <div className="settings-goal-row">
          <div className="settings-goal-header">
            <span className="settings-toggle-name">Target Fat Free Mass (lbs)</span>
            <span className="settings-preview-value">
              {calculatedFfm !== null ? calculatedFfm.toFixed(1) : '—'}
            </span>
          </div>
          {ffmProgress !== null && (
            <>
              <div className="settings-goal-bar-track">
                <div className="settings-goal-bar-fill" style={{ width: `${ffmProgress}%` }} />
              </div>
              <span className="settings-goal-caption">
                Current {latestStats!.fatFreeMass} lbs → Goal {calculatedFfm!.toFixed(1)} lbs
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Import from Hevy ── */}
      <div className="settings-section" style={{ marginTop: '1.5rem' }}>
        <h3 className="settings-section-title">
          <Upload size={18} />
          Import from Hevy
        </h3>

        <div className="settings-instructions">
          <p>Import your workout history from Hevy to see it in your progress charts and calendar.</p>
          <p className="settings-instructions-steps">
            <strong>How to export from Hevy:</strong> Profile → Settings → Export &amp; Import Data → Export Workouts
          </p>
        </div>

        <div className="settings-warning">
          <AlertTriangle size={14} />
          <span>Re-importing the same file will create duplicate entries. Only import each file once.</span>
        </div>

        {(phase === 'idle' || phase === 'error') && (
          <div className="settings-file-picker">
            <label className="btn-primary settings-file-label">
              <FileText size={16} />
              Select CSV file
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="settings-file-input"
              />
            </label>
          </div>
        )}

        {error && <p className="settings-error">{error}</p>}

        {phase === 'preview' && summary && (
          <div className="settings-preview">
            <h4 className="settings-preview-title">Import Preview</h4>
            <div className="settings-preview-grid">
              <div className="settings-preview-item">
                <span className="settings-preview-label">Date range</span>
                <span className="settings-preview-value">{summary.dateRange.start} → {summary.dateRange.end}</span>
              </div>
              <div className="settings-preview-item">
                <span className="settings-preview-label">Total sets</span>
                <span className="settings-preview-value">{summary.totalSets.toLocaleString()}</span>
              </div>
              <div className="settings-preview-item">
                <span className="settings-preview-label">Exercises</span>
                <span className="settings-preview-value">{summary.uniqueExercises}</span>
              </div>
              <div className="settings-preview-item">
                <span className="settings-preview-label">Workouts</span>
                <span className="settings-preview-value">{summary.workoutCount}</span>
              </div>
            </div>
            <div className="settings-preview-actions">
              <button className="btn-primary" onClick={handleImport}>
                Import {summary.totalSets.toLocaleString()} sets
              </button>
              <button className="btn-secondary" onClick={handleReset}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {phase === 'importing' && (
          <div className="settings-importing">
            <Loader size={20} className="settings-spinner" />
            <span>Importing to Google Sheet…</span>
          </div>
        )}

        {phase === 'done' && (
          <div className="settings-done">
            <div className="settings-done-message">
              <Check size={20} />
              <span>Successfully imported {importedCount.toLocaleString()} sets.</span>
            </div>
            <button className="btn-secondary" onClick={handleReset}>
              Import another file
            </button>
          </div>
        )}
      </div>

      {/* ── Google Sheet ── */}
      <div className="settings-section settings-section-disconnect">
        <h3 className="settings-section-title">
          <Unlink size={18} />
          Google Sheet
        </h3>
        <p className="settings-disconnect-description">
          Disconnect the current Google Sheet to connect a different one.
          Your data in the sheet will not be deleted.
        </p>
        <button className="btn-danger" onClick={() => {
          if (window.confirm('Disconnect this Google Sheet? You can reconnect it later.')) {
            clearSheetId();
            onDisconnectSheet();
          }
        }}>
          Disconnect Sheet
        </button>
      </div>
    </div>
  );
}
