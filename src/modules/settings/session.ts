import { LazyStore } from "@tauri-apps/plugin-store";
import type { Tab } from "@/modules/tabs/lib/useTabs";

export type Session = {
  tabs: Tab[];
  activeId: number;
};

const STORE_PATH = "notex-session.json";
const KEY_TABS = "tabs";
const KEY_ACTIVE_ID = "activeId";

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 500 });

export async function loadSession(): Promise<Session | null> {
  const tabs = await store.get<Tab[]>(KEY_TABS);
  const activeId = await store.get<number>(KEY_ACTIVE_ID);

  if (!tabs || tabs.length === 0) return null;

  return {
    tabs,
    activeId: activeId ?? tabs[0].id,
  };
}

export async function saveSession(session: Session): Promise<void> {
  await store.set(KEY_TABS, session.tabs);
  await store.set(KEY_ACTIVE_ID, session.activeId);
  await store.save();
}

export async function clearSession(): Promise<void> {
  await store.delete(KEY_TABS);
  await store.delete(KEY_ACTIVE_ID);
  await store.save();
}
