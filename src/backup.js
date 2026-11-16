// Export / import a backup file (.json) with all subjects and grades.

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative, replaceState, saveState, serialize, state } from './store.js';

export async function exportBackup() {
  const json = JSON.stringify({ ...serialize(), exportedAt: new Date().toISOString() }, null, 2);
  const fileName = `gradecheck-${new Date().toISOString().slice(0, 10)}.json`;

  if (isNative) {
    // Android: write the file to the app cache and open the share sheet
    // (Drive, Gmail, WhatsApp, Files...).
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({
        title: 'Copia de seguridad de GradeCheck',
        files: [uri],
        dialogTitle: 'Guardar copia de seguridad',
      });
    } catch (error) {
      if (!/cancel/i.test(String(error?.message ?? error))) throw error;
    }
    return;
  }

  // Web: normal download.
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Reads a backup file. Throws if it isn't a GradeCheck backup. */
export async function readBackupFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida');
  }
  if (!data || !Array.isArray(data.subjects)) {
    throw new Error('El archivo no es una copia de seguridad de GradeCheck');
  }
  return data;
}

/** Replaces all the data with the backup and saves it. */
export function applyBackup(data) {
  const previous = serialize();
  try {
    replaceState(data);
  } catch (error) {
    replaceState(previous);
    throw error;
  }
  saveState();
  return state.subjects.length;
}
