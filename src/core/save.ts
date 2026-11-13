import { newSave, sanitizeSave, type SaveData } from '../systems/progression';

const KEY = 'sur-otesi-save-v1';

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeSave(JSON.parse(raw)) : newSave();
  } catch {
    return newSave();
  }
}

export function storeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* depolama kapalıysa sessizce geç */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yoksay */
  }
}
