import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  EditorStack,
  NewEditorDialog,
  type EditorPaneHandle,
} from "@/modules/editor";
import { getLaunchDir } from "@/lib/launchDir";
import { useZoom } from "@/lib/useZoom";
import { CommandPalette } from "@/modules/command-palette";
import { addRecentFile } from "@/modules/command-palette/recentFiles";
import { FileExplorer, type FileExplorerHandle } from "@/modules/explorer";
import {
  Header,
  type SearchInlineHandle,
  type SearchTarget,
} from "@/modules/header";
import { PreviewStack, type PreviewPaneHandle } from "@/modules/preview";
import { ApiClientStack } from "@/modules/api-client";
import {
  isLiveServerRunning,
  startLiveServer,
  stopLiveServer,
} from "@/modules/preview/liveServer";
import { openSettingsWindow } from "@/modules/settings/openSettingsWindow";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { saveSession, type Session } from "@/modules/settings/session";
import { useGitStore } from "@/modules/git/gitStore";
import {
  ShortcutsDialog,
  useGlobalShortcuts,
  type ShortcutHandlers,
} from "@/modules/shortcuts";
import { StatusBar } from "@/modules/statusbar";
import { MAX_PANES_PER_TAB, useTabs, useWorkspaceCwd } from "@/modules/tabs";
import {
  disposeSession,
  hasLeaf,
  leafIds,
  respawnSession,
  setBroadcastState,
  TerminalStack,
  type TerminalPaneHandle,
} from "@/modules/terminal";
import { ThemeProvider } from "@/modules/theme";
import { UpdaterDialog } from "@/modules/updater";
import {
  getWslHome,
  LOCAL_WORKSPACE,
  useWorkspaceEnvStore,
  type WorkspaceEnv,
} from "@/modules/workspace";
import { NewSnippetDialog } from "@/modules/snippets";
import { homeDir } from "@tauri-apps/api/path";
import type { SearchAddon } from "@xterm/addon-search";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

export default function App({ initialSession }: { initialSession?: Session }) {
  const {
    tabs,
    activeId,
    setActiveId,
    newTab,
    newPrivateTab,
    openFileTab,
    pinTab,
    newPreviewTab,
    newApiClientTab,
    closeTab,
    updateTab,
    selectByIndex,
    setLeafCwd,
    focusPane,
    focusNextPaneInTab,
    splitActivePane,
    closeActivePane,
    closePaneByLeaf,
    resetWorkspace,
    broadcastActive,
    toggleBroadcast,
  } = useTabs(
    initialSession
      ? { tabs: initialSession.tabs, activeId: initialSession.activeId }
      : getLaunchDir()
        ? { cwd: getLaunchDir() }
        : undefined,
  );

  useEffect(() => {
    void saveSession({ tabs, activeId });
  }, [tabs, activeId]);

  const refreshGit = useGitStore((s) => s.refresh);
  useEffect(() => {
    const handleFocus = () => void refreshGit();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshGit]);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const activeTerminalTab = useMemo(() => {
    const t = tabs.find((x) => x.id === activeId);
    return t && t.kind === "terminal" ? t : null;
  }, [tabs, activeId]);
  const activeLeafId = activeTerminalTab?.activeLeafId ?? null;

  const searchAddons = useRef<Map<number, SearchAddon>>(new Map());
  const [activeSearchAddon, setActiveSearchAddon] =
    useState<SearchAddon | null>(null);
  const searchInlineRef = useRef<SearchInlineHandle | null>(null);
  const terminalRefs = useRef<Map<number, TerminalPaneHandle>>(new Map());
  const editorRefs = useRef<Map<number, EditorPaneHandle>>(new Map());
  const previewRefs = useRef<Map<number, PreviewPaneHandle>>(new Map());
  const [activeEditorHandle, setActiveEditorHandle] =
    useState<EditorPaneHandle | null>(null);
  const { zoomIn, zoomOut, zoomReset } = useZoom();
  const explorerRef = useRef<FileExplorerHandle>(null);
  const explorerReturnFocusRef = useRef<HTMLElement | null>(null);

  const sidebarPosition = usePreferencesStore((s) => s.sidebarPosition);
  const sidebarFirst = sidebarPosition === "left";

  const sidebarRef = useRef<PanelImperativeHandle | null>(null);
  const toggleSidebar = useCallback(() => {
    const p = sidebarRef.current;
    if (!p) return;
    if (p.getSize().asPercentage <= 0) p.expand();
    else p.collapse();
  }, []);

  const toggleExplorerFocus = useCallback(() => {
    const explorer = explorerRef.current;
    if (!explorer) return;
    if (explorer.isFocused()) {
      const target = explorerReturnFocusRef.current;
      explorerReturnFocusRef.current = null;
      if (target && document.body.contains(target)) {
        target.focus();
      } else {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      return;
    }
    const active = document.activeElement;
    explorerReturnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    const p = sidebarRef.current;
    if (p && p.getSize().asPercentage <= 0) p.expand();
    explorer.focus();
  }, []);

  const [home, setHome] = useState<string | null>(null);
  const [pendingCloseTab, setPendingCloseTab] = useState<number | null>(null);
  const workspaceEnv = useWorkspaceEnvStore((s) => s.env);
  const setWorkspaceEnv = useWorkspaceEnvStore((s) => s.setEnv);
  const [pendingDeleteTabs, setPendingDeleteTabs] = useState<number[] | null>(
    null,
  );
  useEffect(() => {
    homeDir()
      .then((p) => setHome(p.replace(/\\/g, "/")))
      .catch(() => setHome(null));
  }, []);

  const switchWorkspace = useCallback(
    async (env: WorkspaceEnv) => {
      if (
        env.kind === workspaceEnv.kind &&
        (env.kind === "local" ||
          (workspaceEnv.kind === "wsl" && env.distro === workspaceEnv.distro))
      ) {
        return;
      }
      const dirty = tabsRef.current.some((t) => t.kind === "editor" && t.dirty);
      if (dirty) {
        window.alert("Save or close unsaved editor tabs before switching workspace.");
        return;
      }

      let nextHome: string | null = null;
      try {
        if (env.kind === "wsl") {
          nextHome = await getWslHome(env.distro);
        } else {
          nextHome = (await homeDir()).replace(/\\/g, "/");
        }
      } catch (e) {
        window.alert(String(e));
        return;
      }

      for (const id of liveLeavesRef.current) disposeSession(id);
      searchAddons.current.clear();
      terminalRefs.current.clear();
      editorRefs.current.clear();
      previewRefs.current.clear();
      setActiveSearchAddon(null);
      setActiveEditorHandle(null);
      setWorkspaceEnv(env.kind === "local" ? LOCAL_WORKSPACE : env);
      setHome(nextHome);
      resetWorkspace(nextHome ?? undefined);
    },
    [workspaceEnv, setWorkspaceEnv, resetWorkspace],
  );

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [newEditorOpen, setNewEditorOpen] = useState(false);
  const [newSnippetOpen, setNewSnippetOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteDefaultQuery, setCommandPaletteDefaultQuery] =
    useState("");
  const [liveServerRunning, setLiveServerRunning] = useState(false);
  const [liveServerBusy, setLiveServerBusy] = useState(false);

  const initPrefs = usePreferencesStore((s) => s.init);
  useEffect(() => {
    void initPrefs();
  }, [initPrefs]);

  const activeTab = tabs.find((t) => t.id === activeId);
  const isTerminalTab = activeTab?.kind === "terminal";
  const isEditorTab = activeTab?.kind === "editor";
  const isPreviewTab = activeTab?.kind === "preview";

  const { explorerRoot, inheritedCwdForNewTab } = useWorkspaceCwd(
    activeTab,
    tabs,
    home,
  );

  useEffect(() => {
    setActiveSearchAddon(
      activeLeafId !== null ? (searchAddons.current.get(activeLeafId) ?? null) : null,
    );
    setActiveEditorHandle(editorRefs.current.get(activeId) ?? null);
  }, [activeId, activeLeafId]);

  const handleSearchReady = useCallback(
    (leafId: number, addon: SearchAddon) => {
      searchAddons.current.set(leafId, addon);
      if (leafId === activeLeafId) setActiveSearchAddon(addon);
    },
    [activeLeafId],
  );

  const disposeTab = useCallback(
    (id: number) => {
      editorRefs.current.delete(id);
      previewRefs.current.delete(id);
      closeTab(id);
    },
    [closeTab],
  );

  const liveLeavesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const live = new Set<number>();
    for (const t of tabs) {
      if (t.kind === "terminal") {
        for (const id of leafIds(t.paneTree)) live.add(id);
      }
    }
    for (const id of liveLeavesRef.current) {
      if (!live.has(id)) disposeSession(id);
    }
    liveLeavesRef.current = live;
    for (const k of [...terminalRefs.current.keys()])
      if (!live.has(k)) terminalRefs.current.delete(k);
    for (const k of [...searchAddons.current.keys()])
      if (!live.has(k)) searchAddons.current.delete(k);
  }, [tabs]);

  const handleClose = useCallback(
    (id: number) => {
      const t = tabs.find((x) => x.id === id);
      if (t?.kind === "editor" && t.dirty) {
        setPendingCloseTab(id);
        return;
      }
      disposeTab(id);
    },
    [tabs, disposeTab],
  );

  const handleRenameTab = useCallback(
    (id: number, title: string) => {
      const t = tabsRef.current.find((x) => x.id === id);
      if (!t || t.kind !== "terminal") return;
      const trimmed = title.trim();
      if (!trimmed || trimmed === t.title) return;
      updateTab(id, { title: trimmed });
    },
    [updateTab],
  );

  const confirmClose = useCallback(() => {
    if (pendingCloseTab !== null) {
      disposeTab(pendingCloseTab);
      setPendingCloseTab(null);
    }
  }, [pendingCloseTab, disposeTab]);

  const cancelClose = useCallback(() => {
    setPendingCloseTab(null);
  }, []);

  const cycleTab = useCallback(
    (delta: 1 | -1) => {
      if (tabs.length < 2) return;
      const idx = tabs.findIndex((t) => t.id === activeId);
      const nextIdx = (idx + delta + tabs.length) % tabs.length;
      setActiveId(tabs[nextIdx].id);
    },
    [tabs, activeId, setActiveId],
  );

  const openNewTab = useCallback(() => {
    newTab(inheritedCwdForNewTab());
  }, [newTab, inheritedCwdForNewTab]);

  const openNewPrivateTab = useCallback(() => {
    newPrivateTab(inheritedCwdForNewTab());
  }, [newPrivateTab, inheritedCwdForNewTab]);

  const sendCd = useCallback(
    (path: string) => {
      if (activeLeafId === null) return;
      const term = terminalRefs.current.get(activeLeafId);
      if (!term) return;
      const quoted = path.includes(" ")
        ? `'${path.replace(/'/g, `'\\''`)}'`
        : path;
      term.write(`cd ${quoted}\r`);
      term.focus();
    },
    [activeLeafId],
  );

  const cdInNewTab = useCallback(
    (path: string) => {
      const tabId = newTab(path);
      setTimeout(() => {
        const tab = tabsRef.current.find((x) => x.id === tabId);
        if (!tab || tab.kind !== "terminal") return;
        const t = terminalRefs.current.get(tab.activeLeafId);
        if (!t) return;
        const quoted = path.includes(" ")
          ? `'${path.replace(/'/g, `'\\''`)}'`
          : path;
        t.write(`cd ${quoted}\r`);
        t.focus();
      }, 80);
    },
    [newTab],
  );

  const runTaskInTerminal = useCallback(
    (command: string) => {
      const t = tabsRef.current.find((x) => x.id === activeId);
      if (t?.kind === "terminal") {
        const term = terminalRefs.current.get(t.activeLeafId);
        if (term) {
          term.write(`${command}\r`);
          term.focus();
          return;
        }
      }
      const tabId = newTab(inheritedCwdForNewTab());
      setTimeout(() => {
        const tab = tabsRef.current.find((x) => x.id === tabId);
        if (!tab || tab.kind !== "terminal") return;
        const term = terminalRefs.current.get(tab.activeLeafId);
        if (!term) return;
        term.write(`${command}\r`);
        term.focus();
      }, 100);
    },
    [activeId, newTab, inheritedCwdForNewTab],
  );

  const handleOpenFile = useCallback(
    (path: string, pin?: boolean) => {
      openFileTab(path, pin ?? false);
    },
    [openFileTab],
  );

  const handlePathRenamed = useCallback(
    (from: string, to: string) => {
      for (const t of tabs) {
        if (t.kind !== "editor") continue;
        if (t.path === from) {
          const i = to.lastIndexOf("/");
          updateTab(t.id, { path: to, title: i === -1 ? to : to.slice(i + 1) });
        } else if (t.path.startsWith(`${from}/`)) {
          const suffix = t.path.slice(from.length);
          const newPath = `${to}${suffix}`;
          const i = newPath.lastIndexOf("/");
          updateTab(t.id, {
            path: newPath,
            title: i === -1 ? newPath : newPath.slice(i + 1),
          });
        }
      }
    },
    [tabs, updateTab],
  );

  const confirmDeleteClose = useCallback(() => {
    if (pendingDeleteTabs !== null) {
      for (const id of pendingDeleteTabs) disposeTab(id);
      setPendingDeleteTabs(null);
    }
  }, [pendingDeleteTabs, disposeTab]);

  const cancelDeleteClose = useCallback(() => {
    setPendingDeleteTabs(null);
  }, []);

  const handlePathDeleted = useCallback(
    (path: string) => {
      const dirty: number[] = [];
      for (const t of tabs) {
        if (t.kind !== "editor") continue;
        if (t.path !== path && !t.path.startsWith(`${path}/`)) continue;
        if (t.dirty) {
          dirty.push(t.id);
        } else {
          disposeTab(t.id);
        }
      }
      if (dirty.length > 0) setPendingDeleteTabs(dirty);
    },
    [tabs, disposeTab],
  );

  const activeFilePath = activeTab?.kind === "editor" ? activeTab.path : null;

  useEffect(() => {
    if (activeFilePath) addRecentFile(activeFilePath);
  }, [activeFilePath]);

  const handleGotoLine = useCallback(
    (line: number) => {
      if (activeId !== null) {
        editorRefs.current.get(activeId)?.gotoLine(line);
      }
    },
    [activeId],
  );

  const openPreviewTab = useCallback(
    (url: string) => {
      const id = newPreviewTab(url);
      if (!url) {
        setTimeout(() => previewRefs.current.get(id)?.focusAddressBar(), 0);
      }
      return id;
    },
    [newPreviewTab],
  );

  const openApiClient = useCallback(() => {
    newApiClientTab();
  }, [newApiClientTab]);

  const splitActivePaneInActiveTab = useCallback(
    (dir: "row" | "col") => {
      const t = tabsRef.current.find((x) => x.id === activeId);
      if (!t || t.kind !== "terminal") return;
      splitActivePane(activeId, dir);
    },
    [activeId, splitActivePane],
  );

  const handleCloseTabOrPane = useCallback(() => {
    const t = tabsRef.current.find((x) => x.id === activeId);
    if (t?.kind === "terminal" && leafIds(t.paneTree).length > 1) {
      closeActivePane(activeId);
      return;
    }
    handleClose(activeId);
  }, [activeId, closeActivePane, handleClose]);

  const shortcutHandlers = useMemo<ShortcutHandlers>(
    () => ({
      "tab.new": openNewTab,
      "tab.newPrivate": openNewPrivateTab,
      "api.client": openApiClient,
      "preview.open": () => openPreviewTab(""),
      "tab.newEditor": () => setNewEditorOpen(true),
      "tab.close": handleCloseTabOrPane,
      "tab.next": () => cycleTab(1),
      "tab.prev": () => cycleTab(-1),
      "tab.selectByIndex": (e) => selectByIndex(parseInt(e.key, 10) - 1),
      "pane.splitRight": () => splitActivePaneInActiveTab("row"),
      "pane.splitDown": () => splitActivePaneInActiveTab("col"),
      "pane.focusNext": () => focusNextPaneInTab(activeId, 1),
      "pane.focusPrev": () => focusNextPaneInTab(activeId, -1),
      "search.focus": () => searchInlineRef.current?.focus(),
      "shortcuts.open": () => setShortcutsOpen((v) => !v),
      "settings.open": () => void openSettingsWindow(),
      "git.commitAll": () => {
        const msg = window.prompt("Commit message:");
        if (msg) void useGitStore.getState().commitAll(msg);
      },
      "git.push": () => void useGitStore.getState().push(),
      "git.pull": () => void useGitStore.getState().pull(),
      "snippets.add": () => setNewSnippetOpen(true),
      "snippets.manage": () => {
        setCommandPaletteDefaultQuery("!");
        setCommandPaletteOpen(true);
      },
      "commandPalette.open": () => {
        setCommandPaletteDefaultQuery("");
        setCommandPaletteOpen(true);
      },
      "commandPalette.openCommand": () => {
        setCommandPaletteDefaultQuery(">");
        setCommandPaletteOpen(true);
      },
      "sidebar.toggle": toggleSidebar,
      "explorer.focus": toggleExplorerFocus,
      "view.zoomIn": zoomIn,
      "view.zoomOut": zoomOut,
      "view.zoomReset": zoomReset,
    }),
    [
      activeId,
      cycleTab,
      handleCloseTabOrPane,
      openNewTab,
      openNewPrivateTab,
      openPreviewTab,
      selectByIndex,
      splitActivePaneInActiveTab,
      focusNextPaneInTab,
      toggleSidebar,
      toggleExplorerFocus,
      zoomIn,
      zoomOut,
      zoomReset,
      setCommandPaletteOpen,
      setCommandPaletteDefaultQuery,
    ],
  );

  useGlobalShortcuts(shortcutHandlers);

  const registerTerminalHandle = useCallback(
    (leafId: number, h: TerminalPaneHandle | null) => {
      if (h) terminalRefs.current.set(leafId, h);
      else terminalRefs.current.delete(leafId);
    },
    [],
  );

  const registerEditorHandle = useCallback(
    (id: number, h: EditorPaneHandle | null) => {
      if (h) editorRefs.current.set(id, h);
      else editorRefs.current.delete(id);
      if (id === activeId) setActiveEditorHandle(h);
    },
    [activeId],
  );

  const registerPreviewHandle = useCallback(
    (id: number, h: PreviewPaneHandle | null) => {
      if (h) previewRefs.current.set(id, h);
      else previewRefs.current.delete(id);
    },
    [],
  );

  const handlePreviewUrl = useCallback(
    (id: number, url: string) => updateTab(id, { url }),
    [updateTab],
  );

  const handleTerminalCwd = useCallback(
    (leafId: number, cwd: string) => setLeafCwd(leafId, cwd),
    [setLeafCwd],
  );

  const handleFocusLeaf = useCallback(
    (tabId: number, leafId: number) => focusPane(tabId, leafId),
    [focusPane],
  );

  const handleLeafExit = useCallback(
    (leafId: number, _code: number) => {
      const all = tabsRef.current;
      const tab = all.find(
        (t) => t.kind === "terminal" && hasLeaf(t.paneTree, leafId),
      );
      if (!tab || tab.kind !== "terminal") return;
      const isLast =
        leafIds(tab.paneTree).length === 1 &&
        all.filter((t) => t.kind === "terminal").length === 1;
      if (isLast) {
        void respawnSession(leafId, tab.cwd);
      } else {
        closePaneByLeaf(leafId);
      }
    },
    [closePaneByLeaf],
  );

  const handleEditorDirty = useCallback(
    (id: number, dirty: boolean) => updateTab(id, { dirty }),
    [updateTab],
  );

  const searchTarget = useMemo<SearchTarget>(() => {
    if (isTerminalTab && activeSearchAddon)
      return {
        kind: "terminal",
        addon: activeSearchAddon,
        focus: () => terminalRefs.current.get(activeId)?.focus(),
      };
    if (isEditorTab && activeEditorHandle)
      return {
        kind: "editor",
        handle: activeEditorHandle,
        focus: () => activeEditorHandle.focus(),
      };
    return null;
  }, [isTerminalTab, isEditorTab, activeId, activeSearchAddon, activeEditorHandle]);

  const activeCwd = useMemo(() => {
    if (activeTab?.kind === "terminal") return activeTab.cwd ?? null;
    if (activeTab?.kind === "editor") {
      const i = activeTab.path.lastIndexOf("/");
      return i === -1 ? null : activeTab.path.slice(0, i);
    }
    return explorerRoot ?? home;
  }, [activeTab, explorerRoot, home]);
  const liveRootPath = explorerRoot ?? activeCwd ?? home;

  useEffect(() => {
    if (!liveRootPath) {
      setLiveServerRunning(false);
      return;
    }
    let alive = true;
    void isLiveServerRunning(liveRootPath).then((v) => {
      if (!alive) return;
      setLiveServerRunning(v);
    });
    return () => {
      alive = false;
    };
  }, [liveRootPath]);

  const handleToggleLiveServer = useCallback(async () => {
    if (!liveRootPath || liveServerBusy) return;
    setLiveServerBusy(true);
    try {
      if (liveServerRunning) {
        await stopLiveServer(liveRootPath);
        setLiveServerRunning(false);
        return;
      }
      const { url, mode } = await startLiveServer(liveRootPath);
      setLiveServerRunning(true);
      if (mode === "vite-dist") {
        window.alert("Vite project detected: serving dist/ output.");
      }
      const active = tabsRef.current.find((t) => t.id === activeId);
      if (active?.kind === "preview") {
        updateTab(active.id, { url });
      } else {
        openPreviewTab(url);
      }
    } catch (e) {
      window.alert(String(e));
    } finally {
      setLiveServerBusy(false);
    }
  }, [
    liveRootPath,
    liveServerBusy,
    liveServerRunning,
    activeId,
    updateTab,
    openPreviewTab,
  ]);

  const sidebarPanel = (
    <ResizablePanel
      key="sidebar-panel"
      id="sidebar"
      panelRef={sidebarRef}
      defaultSize="225px"
      minSize="130px"
      maxSize="450px"
      collapsible
      collapsedSize={0}
    >
      <div
        className={cn(
          "h-full border-border/60 bg-card",
          sidebarFirst ? "border-r" : "border-l",
        )}
      >
        <FileExplorer
          ref={explorerRef}
          rootPath={explorerRoot}
          onOpenFile={handleOpenFile}
          onPathRenamed={handlePathRenamed}
          onPathDeleted={handlePathDeleted}
          onRevealInTerminal={cdInNewTab}
        />
      </div>
    </ResizablePanel>
  );

  const workspacePanel = (
    <ResizablePanel
      key="workspace-panel"
      id="workspace"
      defaultSize="78%"
      minSize="30%"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative min-h-0 flex-1">
          <div
            className={cn(
              "absolute inset-0 px-3 pt-2 pb-2",
              !isTerminalTab && "invisible pointer-events-none",
            )}
            aria-hidden={!isTerminalTab}
          >
            <TerminalStack
              tabs={tabs}
              activeId={activeId}
              registerHandle={registerTerminalHandle}
              onSearchReady={handleSearchReady}
              onCwd={handleTerminalCwd}
              onExit={handleLeafExit}
              onFocusLeaf={handleFocusLeaf}
            />
          </div>
          <div
            className={cn(
              "absolute inset-0",
              !isEditorTab && "invisible pointer-events-none",
            )}
            aria-hidden={!isEditorTab}
          >
            <EditorStack
              tabs={tabs}
              activeId={activeId}
              registerHandle={registerEditorHandle}
              onDirtyChange={handleEditorDirty}
              onCloseTab={disposeTab}
              onOpenFile={handleOpenFile}
            />
          </div>
          <div
            className={cn(
              "absolute inset-0 px-3 pt-2 pb-2",
              !isPreviewTab && "invisible pointer-events-none",
            )}
            aria-hidden={!isPreviewTab}
          >
            <PreviewStack
              tabs={tabs}
              activeId={activeId}
              rootPath={explorerRoot ?? activeCwd ?? home}
              registerHandle={registerPreviewHandle}
              onUrlChange={handlePreviewUrl}
            />
          </div>
          <div
            className={cn(
              "absolute inset-0",
              activeTab?.kind !== "api-client" &&
                "invisible pointer-events-none",
            )}
            aria-hidden={activeTab?.kind !== "api-client"}
          >
            <ApiClientStack tabs={tabs} activeId={activeId} />
          </div>
        </div>
      </div>
    </ResizablePanel>
  );

  const mainHandle = <ResizableHandle key="main-handle" withHandle />;

  const shell = (
    <ThemeProvider>
      <TooltipProvider>
        <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
          <Header
            tabs={tabs}
            activeId={activeId}
            onSelect={setActiveId}
            onNew={openNewTab}
            onNewPrivate={openNewPrivateTab}
            onNewPreview={() => openPreviewTab("")}
            onNewEditor={() => setNewEditorOpen(true)}
            onClose={handleClose}
            onRenameTab={handleRenameTab}
            onPin={pinTab}
            onToggleSidebar={toggleSidebar}
            onSplit={splitActivePaneInActiveTab}
            canSplit={
              activeTerminalTab !== null &&
              leafIds(activeTerminalTab.paneTree).length < MAX_PANES_PER_TAB
            }
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenSettings={() => void openSettingsWindow()}
            searchTarget={searchTarget}
            searchRef={searchInlineRef}
          />

          <main className="zoom-content flex min-h-0 flex-1 flex-col">
            <ResizablePanelGroup
              orientation="horizontal"
              className="min-h-0 flex-1"
            >
              {sidebarFirst ? (
                <>
                  {sidebarPanel}
                  {mainHandle}
                  {workspacePanel}
                </>
              ) : (
                <>
                  {workspacePanel}
                  {mainHandle}
                  {sidebarPanel}
                </>
              )}
            </ResizablePanelGroup>
          </main>

          <StatusBar
            cwd={activeCwd}
            filePath={activeFilePath}
            home={home}
            onCd={sendCd}
            onWorkspaceChange={switchWorkspace}
            liveServerAvailable={Boolean(liveRootPath)}
            liveServerRunning={liveServerRunning}
            liveServerBusy={liveServerBusy}
            onToggleLiveServer={() => void handleToggleLiveServer()}
            broadcastActive={broadcastActive}
            onToggleBroadcast={toggleBroadcast}
            privateActive={
              activeTab?.kind === "terminal" && activeTab.private === true
            }
          />

          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            defaultQuery={commandPaletteDefaultQuery}
            rootPath={explorerRoot ?? home ?? ""}
            activeFilePath={activeFilePath}
            onOpenFile={handleOpenFile}
            onGotoLine={handleGotoLine}
            onRunTask={runTaskInTerminal}
            handlers={shortcutHandlers}
          />

          <ShortcutsDialog
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />

          <NewEditorDialog
            open={newEditorOpen}
            onOpenChange={setNewEditorOpen}
            rootPath={explorerRoot ?? home}
            onCreated={(path) => handleOpenFile(path)}
          />

          <NewSnippetDialog
            open={newSnippetOpen}
            onOpenChange={setNewSnippetOpen}
          />


          <UpdaterDialog />

          <AlertDialog
            open={pendingCloseTab !== null}
            onOpenChange={(open) => !open && cancelClose()}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                <AlertDialogDescription>
                  {tabs.find((t) => t.id === pendingCloseTab)?.title
                    ? `"${
                        tabs.find((t) => t.id === pendingCloseTab)?.title
                      }" has unsaved changes. Close anyway?`
                    : "This file has unsaved changes. Close anyway?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelClose}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={confirmClose}>
                  Close Anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={pendingDeleteTabs !== null}
            onOpenChange={(open) => !open && cancelDeleteClose()}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingDeleteTabs?.length === 1
                    ? (() => {
                        const title = tabs.find(
                          (t) => t.id === pendingDeleteTabs[0],
                        )?.title;
                        return title
                          ? `"${title}" has unsaved changes. The file has been deleted. Close anyway?`
                          : "This file has unsaved changes. The file has been deleted. Close anyway?";
                      })()
                    : `${pendingDeleteTabs?.length ?? 0} files have unsaved changes. They have been deleted. Close all anyway?`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelDeleteClose}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteClose}>
                  Close Anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );

  useEffect(() => {
    if (activeTerminalTab && broadcastActive) {
      setBroadcastState(true, leafIds(activeTerminalTab.paneTree));
    } else {
      setBroadcastState(false, []);
    }
  }, [activeTerminalTab, broadcastActive]);

  return shell;
}
