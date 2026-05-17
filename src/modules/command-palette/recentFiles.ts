const KEY = "notex.commandPalette.recentFiles";
const MAX_RECENT = 12;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function write(paths: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(paths.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota/storage errors
  }
}

export function getRecentFiles(): string[] {
  return read();
}

export function addRecentFile(path: string): void {
  if (!path) return;
  const next = [path, ...read().filter((p) => p !== path)];
  write(next);
}
