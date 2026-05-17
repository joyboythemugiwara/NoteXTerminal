import type { ShortcutId } from "@/modules/shortcuts/shortcuts";

const KEY = "notex.commandPalette.pinnedCommands";
const MAX_PINNED = 10;

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
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_PINNED)));
  } catch {
    // ignore storage errors
  }
}

export function getPinnedCommands(): ShortcutId[] {
  return read();
}

export function togglePinnedCommand(id: ShortcutId): ShortcutId[] {
  const curr = read();
  if (curr.includes(id)) {
    const next = curr.filter((x) => x !== id);
    write(next);
    return next;
  }
  const next = [id, ...curr.filter((x) => x !== id)];
  write(next);
  return next;
}
