// Backup via gapi is no longer supported — Apps Script handles data persistence.
export const BACKUP_SETTING_KEY = 'backupSpreadsheetId'
export async function performBackup(
  _sourceSpreadsheetId: string,
  _settings: Map<string, string>,
): Promise<string> {
  return ''
}
