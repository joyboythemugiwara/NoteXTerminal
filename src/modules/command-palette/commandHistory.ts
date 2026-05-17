import type { ShortcutId } from "@/modules/shortcuts/shortcuts";

const KEY = "notex.commandPalette.commandHistory";
const MAX_HISTORY = 16;

function read(): ShortcutId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is ShortcutId => typeof x === "string");
  } catch {
    return [];
  }
}

function write(ids: ShortcutId[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_HISTORY)));
  } catch {
    // ignore storage errors
  }
}

export function getCommandHistory(): ShortcutId[] {
  return read();
}

export function addCommandHistory(id: ShortcutId): ShortcutId[] {
  const next = [id, ...read().filter((x) => x !== id)];
  write(next);
  return next;
}
