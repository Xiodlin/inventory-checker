import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { localRuntime } from './localRuntime';

export async function exportBackup() {
  if (!await Sharing.isAvailableAsync()) throw new Error('File export is unavailable on this device');
  const file = new File(Paths.cache, 'inventory-backup.json');
  file.write(await (await localRuntime()).store.exportBackup());
  try { await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your inventory backup' }); }
  finally { if (file.exists) file.delete(); }
}
export async function importBackup(): Promise<boolean> {
  const selection = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true, multiple: false });
  if (selection.canceled) return false;
  const file = new File(selection.assets[0].uri);
  try {
    if (file.size > 16 * 1024 * 1024) throw new Error('Backup exceeds the 16 MB limit');
    await (await localRuntime()).store.importBackup(await file.text());
    return true;
  } finally { if (file.exists) file.delete(); }
}
