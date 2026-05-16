import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BACKUP_SETTING_KEY } from '../backup.ts';

// We can't easily test the full performBackup function since it relies on
// window.gapi, but we can verify the constant and basic module shape.

describe('backup module', () => {
	it('exports the expected settings key', () => {
		expect(BACKUP_SETTING_KEY).toBe('backupSpreadsheetId');
	});

	it('performBackup is exported as a function', async () => {
		const { performBackup } = await import('../backup.ts');
		expect(typeof performBackup).toBe('function');
	});
});
