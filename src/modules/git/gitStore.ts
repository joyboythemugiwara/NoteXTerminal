import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type GitStatus = {
  branch: string;
  root: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
};

type GitState = {
  status: GitStatus | null;
  lastPath: string | null;
  syncing: boolean;
  branches: string[];
  refresh: (path?: string | null) => Promise<void>;
  sync: () => Promise<void>;
  listBranches: () => Promise<void>;
  checkout: (branch: string) => Promise<void>;
  commitAll: (message: string) => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  getFileStatus: (path: string) => "modified" | "added" | "deleted" | "untracked" | null;
};

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  lastPath: null,
  syncing: false,
  branches: [],
  refresh: async (path?: string | null) => {
    const target = path || get().lastPath;
    if (!target) return;
    
    set({ lastPath: target });
    try {
      const status = await invoke<GitStatus>("git_get_status", { path: target });
      set({ status });
    } catch (e) {
      // Keep previous status visible if we had one; clear branch list because
      // it's stale and branch switch menu should not offer outdated choices.
      set({ branches: [] });
    }
  },
  sync: async () => {
    const root = get().status?.root || get().lastPath;
    if (!root || get().syncing) return;
    set({ syncing: true });
    try {
      await invoke("git_sync", { path: root });
      const status = await invoke<GitStatus>("git_get_status", { path: root });
      set({ status });
    } catch (e) {
      console.error("Git sync failed", e);
    } finally {
      set({ syncing: false });
    }
  },
  listBranches: async () => {
    const root = get().status?.root || get().lastPath;
    if (!root) return;
    try {
      const branches = await invoke<string[]>("git_list_branches", { path: root });
      set({ branches });
    } catch (e) {
      console.error("Failed to list branches", e);
    }
  },
  checkout: async (branch: string) => {
    const root = get().status?.root || get().lastPath;
    if (!root) return;
    try {
      await invoke("git_checkout_branch", { path: root, branch });
      const status = await invoke<GitStatus>("git_get_status", { path: root });
      set({ status });
    } catch (e) {
      window.alert(String(e));
    }
  },
  commitAll: async (message: string) => {
    const root = get().status?.root || get().lastPath;
    if (!root) return;
    try {
      await invoke("git_commit_all", { path: root, message });
      const status = await invoke<GitStatus>("git_get_status", { path: root });
      set({ status });
    } catch (e) {
      window.alert(String(e));
    }
  },
  push: async () => {
    const root = get().status?.root || get().lastPath;
    if (!root) return;
    try {
      await invoke("git_push", { path: root });
      const status = await invoke<GitStatus>("git_get_status", { path: root });
      set({ status });
    } catch (e) {
      window.alert(String(e));
    }
  },
  pull: async () => {
    const root = get().status?.root || get().lastPath;
    if (!root) return;
    try {
      await invoke("git_pull", { path: root });
      const status = await invoke<GitStatus>("git_get_status", { path: root });
      set({ status });
    } catch (e) {
      window.alert(String(e));
    }
  },
  getFileStatus: (path: string) => {
    const { status } = get();
    if (!status) return null;
    
    const root = status.root;
    if (!path.startsWith(root)) return null;

    let rel = path.slice(root.length);
    if (rel.startsWith("/")) rel = rel.slice(1);
    if (!rel) return null;

    const isInside = (f: string) => f === rel || f.startsWith(`${rel}/`);

    if (status.modified.some(isInside)) return "modified";
    if (status.added.some(isInside)) return "added";
    if (status.deleted.some(isInside)) return "deleted";
    if (status.untracked.some(isInside)) return "untracked";

    return null;
  },
}));
