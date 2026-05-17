import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import { dirname } from "./useFileTree";

/**
 * Hook to manage the lifecycle of the filesystem watcher.
 * It starts/stops the watcher and handles adding/removing directories
 * as they are expanded/collapsed in the tree.
 */
export function useFileTreeWatcher(
  rootPath: string | null,
  expanded: Set<string>,
  onRefresh: (path: string) => void,
) {
  const rootRef = useRef(rootPath);
  const expandedRef = useRef(expanded);
  const lastEventAt = useRef<Record<string, number>>({});

  useEffect(() => {
    rootRef.current = rootPath;
  }, [rootPath]);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  // Handle watcher lifecycle and event listening
  useEffect(() => {
    if (!rootPath) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        await invoke("fs_watcher_start");
        
        // Listen for fs://changed events from Rust
        const un = await listen<string>("fs://changed", (event) => {
          const path = event.payload;
          const parent = dirname(path);

          // Simple debouncing per directory to avoid rapid re-fetches
          const now = Date.now();
          if (now - (lastEventAt.current[parent] || 0) < 100) return;
          lastEventAt.current[parent] = now;

          // If the parent directory is expanded or it is the root, refresh it
          if (parent === rootRef.current || expandedRef.current.has(parent)) {
            onRefresh(parent);
          }
        });
        unlisten = un;

        // Initial watch for root
        await invoke("fs_watcher_add", { path: rootPath });
      } catch (e) {
        console.error("failed to start fs watcher", e);
      }
    };

    setup();

    return () => {
      unlisten?.();
      void invoke("fs_watcher_stop").catch(() => {});
    };
  }, [rootPath, onRefresh]);

  // Sync watched paths with expanded set
  useEffect(() => {
    if (!rootPath) return;

    const currentExpanded = Array.from(expanded);
    // We don't want to watch the root itself recursively, but we already added it.
    // The Rust watcher is non-recursive for performance.
    
    for (const path of currentExpanded) {
      void invoke("fs_watcher_add", { path }).catch(() => {});
    }

    // Note: We don't explicitly 'unwatch' collapsed dirs here for simplicity,
    // as the number of watched dirs is usually small. In a larger app, 
    // we would diff against previous expanded set and call fs_watcher_remove.
  }, [expanded, rootPath]);
}
