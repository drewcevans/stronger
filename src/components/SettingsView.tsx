import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertTriangle, Check, Loader } from 'lucide-react';
import { parseHevyCsv, convertHevyRows, computeImportSummary } from '../model/hevy-import.js';
import type { ImportSummary } from '../model/hevy-import.js';

interface Props {
  spreadsheetId: string;
  onImportComplete: () => void;
  appendLogRows: (spreadsheetId: string, rows: (string | number | boolean)[][]) => Promise<void>;
}

type ImportPhase = 'idle' | 'preview' | 'importing' | 'done' | 'error';

export function SettingsView({ spreadsheetId, onImportComplete, appendLogRows }: Props) {
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [convertedRows, setConvertedRows] = useState<(string | number | boolean)[][] | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const text = await file.text();
      const hevyRows = parseHevyCsv(text);
      if (hevyRows.length === 0) {
        setError('No data rows found in the CSV file.');
        return;
      }
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="settings-view">
      <h2 className="settings-title">Settings</h2>

      <div className="settings-section">
        <h3 className="settings-section-title">
          <Upload size={18} />
          Import from Hevy
        </h3>

        {/* Instructions */}
        <div className="settings-instructions">
          <p>Import your workout history from Hevy to see it in your progress charts and calendar.</p>
          <p className="settings-instructions-steps">
            <strong>How to export from Hevy:</strong> Profile → Settings → Export & Import Data → Export Workouts
          </p>
        </div>

        {/* Duplicate warning */}
        <div className="settings-warning">
          <AlertTriangle size={14} />
          <span>Re-importing the same file will create duplicate entries. Only import each file once.</span>
        </div>

        {/* File picker */}
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

        {/* Error */}
        {error && (
          <p className="settings-error">{error}</p>
        )}

        {/* Preview */}
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

        {/* Importing */}
        {phase === 'importing' && (
          <div className="settings-importing">
            <Loader size={20} className="settings-spinner" />
            <span>Importing to Google Sheet…</span>
          </div>
        )}

        {/* Done */}
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
    </div>
  );
}
