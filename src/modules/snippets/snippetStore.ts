import { LazyStore } from "@tauri-apps/plugin-store";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

export type Snippet = {
  id: string;
  label: string;
  command: string;
};

const STORE_PATH = "notex-snippets.json";
const KEY_SNIPPETS = "snippets";
const SNIPPETS_CHANGED_EVENT = "notex://snippets-changed";

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });

export async function loadSnippets(): Promise<Snippet[]> {
  const snippets = await store.get<Snippet[]>(KEY_SNIPPETS);
  return snippets ?? [];
}

export async function saveSnippets(snippets: Snippet[]): Promise<void> {
  await store.set(KEY_SNIPPETS, snippets);
  await store.save();
  await emit(SNIPPETS_CHANGED_EVENT, snippets);
}

export async function addSnippet(label: string, command: string): Promise<Snippet> {
  const snippets = await loadSnippets();
  const snippet: Snippet = {
    id: Math.random().toString(36).substring(2, 9),
    label,
    command,
  };
  await saveSnippets([...snippets, snippet]);
  return snippet;
}

export async function deleteSnippet(id: string): Promise<void> {
  const snippets = await loadSnippets();
  await saveSnippets(snippets.filter((s) => s.id !== id));
}

export async function updateSnippet(id: string, patch: Partial<Omit<Snippet, "id">>): Promise<void> {
  const snippets = await loadSnippets();
  await saveSnippets(
    snippets.map((s) => (s.id === id ? { ...s, ...patch } : s))
  );
}

export async function onSnippetsChange(
  cb: (snippets: Snippet[]) => void
): Promise<UnlistenFn> {
  const unsubLocal = await store.onChange<Snippet[]>((key, value) => {
    if (key === KEY_SNIPPETS && value) cb(value);
  });
  const unsubEvent = await listen<Snippet[]>(SNIPPETS_CHANGED_EVENT, (e) => {
    cb(e.payload);
  });
  return () => {
    unsubLocal();
    unsubEvent();
  };
}
