import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { fileIconUrl } from "@/modules/explorer/lib/iconResolver";
import { addRecentFile, getRecentFiles } from "@/modules/command-palette/recentFiles";
import {
  addCommandHistory,
  getCommandHistory,
} from "@/modules/command-palette/commandHistory";
import {
  getPinnedCommands,
  togglePinnedCommand,
} from "@/modules/command-palette/pinnedCommands";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  getBindingTokens,
  SHORTCUTS,
  type ShortcutId,
} from "@/modules/shortcuts/shortcuts";
import { currentWorkspaceEnv } from "@/modules/workspace";
import {
  CodeIcon,
  Folder01Icon,
  FunctionIcon,
  PackageIcon,
  Search01Icon,
  QuillWrite01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import {
  loadSnippets,
  onSnippetsChange,
  type Snippet,
} from "@/modules/snippets/snippetStore";

type SearchHit = {
  path: string;
  rel: string;
  name: string;
  is_dir: boolean;
};

type SearchResult = {
  hits: SearchHit[];
  truncated: boolean;
};

type ListFilesResult = {
  files: string[];
  truncated: boolean;
};

type Symbol = {
  name: string;
  kind: string;
  line: number;
};

type ReadResult =
  | { kind: "text"; content: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number; limit: number };

type TaskItem = {
  name: string;
  command: string;
  source: "npm" | "make" | "compose";
};

const DEBOUNCE_MS = 200;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultQuery?: string;
  rootPath: string;
  activeFilePath?: string | null;
  onOpenFile: (path: string) => void;
  onGotoLine: (line: number) => void;
  onRunTask: (command: string) => void;
  handlers: Record<string, (e?: any) => void>;
};

export function CommandPalette({
  open,
  onOpenChange,
  defaultQuery = "",
  rootPath,
  activeFilePath,
  onOpenFile,
  onGotoLine,
  onRunTask,
  handlers,
}: Props) {
  const [query, setQuery] = useState(defaultQuery);
  const [fileResults, setFileResults] = useState<SearchHit[]>([]);
  const [initialFiles, setInitialFiles] = useState<SearchHit[]>([]);
  const [recentFiles, setRecentFiles] = useState<SearchHit[]>([]);
  const [pinnedCommandIds, setPinnedCommandIds] = useState<ShortcutId[]>([]);
  const [recentCommandIds, setRecentCommandIds] = useState<ShortcutId[]>([]);
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const showHidden = usePreferencesStore((s) => s.showHidden);
  const userShortcuts = usePreferencesStore((s) => s.shortcuts);

  const isCommandMode = query.startsWith(">");
  const isSymbolMode = query.startsWith("@");
  const isSnippetMode = query.startsWith("!");
  const effectiveQuery =
    isCommandMode || isSymbolMode || isSnippetMode ? query.slice(1).trim() : query.trim();

  useEffect(() => {
    if (open) {
      setQuery(defaultQuery);
      const recents = getRecentFiles().map((path) => {
        const name = path.split("/").pop() || path;
        let rel = path;
        if (rootPath && path.startsWith(rootPath)) {
          rel = path.slice(rootPath.length).replace(/^\/+/, "") || name;
        }
        return { path, rel, name, is_dir: false } satisfies SearchHit;
      });
      setRecentFiles(recents);
      setPinnedCommandIds(getPinnedCommands());
      setRecentCommandIds(getCommandHistory());
      loadSnippets().then(setSnippets);
    }
  }, [open, defaultQuery, rootPath]);

  useEffect(() => {
    if (!open) return;
    const unsubPromise = onSnippetsChange(setSnippets);
    return () => {
      unsubPromise.then((unsub) => unsub());
    };
  }, [open]);

  // Task runner: detect package.json scripts.
  useEffect(() => {
    if (!open || !rootPath) {
      setTasks([]);
      return;
    }
    const packageJsonPath = rootPath.endsWith("/")
      ? `${rootPath}package.json`
      : `${rootPath}/package.json`;
    const makefilePath = rootPath.endsWith("/")
      ? `${rootPath}Makefile`
      : `${rootPath}/Makefile`;
    const composeYmlPath = rootPath.endsWith("/")
      ? `${rootPath}docker-compose.yml`
      : `${rootPath}/docker-compose.yml`;
    const composeYamlPath = rootPath.endsWith("/")
      ? `${rootPath}docker-compose.yaml`
      : `${rootPath}/docker-compose.yaml`;

    void Promise.allSettled([
      invoke<ReadResult>("fs_read_file", {
        path: packageJsonPath,
        workspace: currentWorkspaceEnv(),
      }),
      invoke<ReadResult>("fs_read_file", {
        path: makefilePath,
        workspace: currentWorkspaceEnv(),
      }),
      invoke<ReadResult>("fs_read_file", {
        path: composeYmlPath,
        workspace: currentWorkspaceEnv(),
      }),
      invoke<ReadResult>("fs_read_file", {
        path: composeYamlPath,
        workspace: currentWorkspaceEnv(),
      }),
    ]).then((results) => {
      const next: TaskItem[] = [];

      const packageResult = results[0];
      if (packageResult.status === "fulfilled" && packageResult.value.kind === "text") {
        try {
          const parsed = JSON.parse(packageResult.value.content) as {
            scripts?: Record<string, string>;
          };
          const scripts = parsed.scripts ?? {};
          for (const name of Object.keys(scripts)) {
            next.push({
              name,
              command: `bun run ${name}`,
              source: "npm",
            });
          }
        } catch {
          // ignore malformed package.json
        }
      }

      const makeResult = results[1];
      if (makeResult.status === "fulfilled" && makeResult.value.kind === "text") {
        const targetRe = /^([A-Za-z0-9][A-Za-z0-9_.-]*):(?:\s|$)/gm;
        const skip = new Set([".PHONY", ".SUFFIXES", ".DEFAULT", ".PRECIOUS"]);
        const seen = new Set<string>();
        let m: RegExpExecArray | null = null;
        while ((m = targetRe.exec(makeResult.value.content)) !== null) {
          const target = m[1];
          if (!target || target.startsWith(".") || skip.has(target) || seen.has(target)) {
            continue;
          }
          seen.add(target);
          next.push({
            name: target,
            command: `make ${target}`,
            source: "make",
          });
        }
      }

      const composeResultCandidates = [results[2], results[3]];
      const composeText = composeResultCandidates
        .find((r) => r.status === "fulfilled" && r.value.kind === "text");
      if (composeText && composeText.status === "fulfilled" && composeText.value.kind === "text") {
        const lines = composeText.value.content.split(/\r?\n/);
        const serviceNames: string[] = [];
        let inServices = false;
        for (const line of lines) {
          if (!inServices) {
            if (/^\s*services:\s*$/.test(line)) inServices = true;
            continue;
          }
          if (/^\S/.test(line)) break;
          const m = /^\s{2,}([A-Za-z0-9_.-]+):\s*$/.exec(line);
          if (m) serviceNames.push(m[1]);
        }

        if (serviceNames.length > 0) {
          next.push({
            name: "compose: up (all)",
            command: "docker compose up -d",
            source: "compose",
          });
          next.push({
            name: "compose: down",
            command: "docker compose down",
            source: "compose",
          });
          for (const svc of serviceNames) {
            next.push({
              name: `compose: up ${svc}`,
              command: `docker compose up -d ${svc}`,
              source: "compose",
            });
            next.push({
              name: `compose: logs ${svc}`,
              command: `docker compose logs -f ${svc}`,
              source: "compose",
            });
          }
        }
      }

      setTasks(next);
    });
  }, [open, rootPath]);

  // Symbols logic
  useEffect(() => {
    if (!open || !isSymbolMode || !activeFilePath) {
      setSymbols([]);
      return;
    }
    void invoke<Symbol[]>("fs_get_symbols", { path: activeFilePath }).then(
      setSymbols,
    );
  }, [open, isSymbolMode, activeFilePath]);

  // Initial files logic
  useEffect(() => {
    if (!open || !rootPath) {
      setInitialFiles([]);
      return;
    }
    void invoke<ListFilesResult>("fs_list_files", {
      root: rootPath,
      limit: 50,
      showHidden,
      workspace: currentWorkspaceEnv(),
    }).then((res) => {
      setInitialFiles(
        res.files.map((rel) => {
          const name = rel.split("/").pop() || rel;
          const path =
            rootPath.endsWith("/") || rel.startsWith("/")
              ? `${rootPath}${rel}`
              : `${rootPath}/${rel}`;
          return {
            path,
            rel,
            name,
            is_dir: false,
          };
        }),
      );
    });
  }, [open, rootPath, showHidden]);

  // File search logic
  useEffect(() => {
    if (!open || isCommandMode || isSymbolMode || isSnippetMode || effectiveQuery.length < 2) {
      setFileResults([]);
      return;
    }

    let alive = true;
    const handle = setTimeout(async () => {
      try {
        const res = await invoke<SearchResult>("fs_search", {
          root: rootPath,
          query: effectiveQuery,
          limit: 50,
          showHidden,
          workspace: currentWorkspaceEnv(),
        });
        if (alive) {
          setFileResults(res.hits);
        }
      } catch (e) {
        console.error("CommandPalette fs_search failed:", e);
      }
    }, DEBOUNCE_MS);

    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [effectiveQuery, isCommandMode, isSnippetMode, open, rootPath, showHidden]);

  const handleSelectCommand = (id: ShortcutId) => {
    const handler = handlers[id];
    if (handler) {
      setRecentCommandIds(addCommandHistory(id));
      handler();
      onOpenChange(false);
    }
  };

  const handleSelectFile = (hit: SearchHit) => {
    if (!hit.is_dir) {
      addRecentFile(hit.path);
      onOpenFile(hit.path);
      onOpenChange(false);
    }
  };

  const handleSelectSymbol = (s: Symbol) => {
    onGotoLine(s.line);
    onOpenChange(false);
  };

  const handleSelectTask = (task: TaskItem) => {
    onRunTask(task.command);
    onOpenChange(false);
  };

  const resultsToDisplay =
    !isCommandMode && !isSymbolMode && !isSnippetMode && effectiveQuery.length < 2
      ? initialFiles
      : fileResults;
  const commandOptions = SHORTCUTS.filter(
    (s) =>
      (s.id as string) !== "commandPalette.open" &&
      (s.id as string) !== "commandPalette.openCommand",
  );
  const pinnedCommandSet = new Set(pinnedCommandIds);
  const pinnedCommands = pinnedCommandIds
    .map((id) => commandOptions.find((s) => s.id === id))
    .filter((s): s is (typeof commandOptions)[number] => Boolean(s));
  const recentCommandSet = new Set(recentCommandIds);
  const recentCommands = recentCommandIds
    .map((id) => commandOptions.find((s) => s.id === id))
    .filter(
      (s): s is (typeof commandOptions)[number] =>
        s !== undefined && !pinnedCommandSet.has(s.id),
    );
  const otherCommands = commandOptions.filter((s) => !pinnedCommandSet.has(s.id));

  const tokensFor = (id: ShortcutId): string[] => {
    const s = SHORTCUTS.find((s) => s.id === id);
    if (!s) return [];
    const bindings = userShortcuts[id] || s.defaultBindings;
    if (!bindings || bindings.length === 0) return [];
    return getBindingTokens(bindings[0]);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command
        label="Command Palette"
        filter={(value, search) => {
          const s =
            search.startsWith(">") || search.startsWith("@") || search.startsWith("!")
              ? search.slice(1).trim()
              : search.trim();
          if (!s) return 1;
          if (value.toLowerCase().includes(s.toLowerCase())) return 1;
          return 0;
        }}
      >
        <CommandInput
          placeholder={
            isCommandMode
              ? "Type a command to run..."
              : isSymbolMode
                ? "Search symbols in file..."
                : isSnippetMode
                  ? "Search snippets..."
                  : "Search files..."
          }
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {isCommandMode ? (
            <>
              {pinnedCommands.length > 0 ? (
                <CommandGroup heading="Pinned">
                  {pinnedCommands.map((s) => (
                    <CommandActionItem
                      key={`pinned:${s.id}`}
                      id={s.id}
                      label={s.label}
                      pinned={true}
                      onRun={handleSelectCommand}
                      onTogglePin={(id) => setPinnedCommandIds(togglePinnedCommand(id))}
                      tokens={tokensFor(s.id)}
                    />
                  ))}
                </CommandGroup>
              ) : null}
              {recentCommands.length > 0 ? (
                <CommandGroup heading="Recent Commands">
                  {recentCommands.map((s) => (
                    <CommandActionItem
                      key={`recent:${s.id}`}
                      id={s.id}
                      label={s.label}
                      pinned={pinnedCommandSet.has(s.id)}
                      onRun={handleSelectCommand}
                      onTogglePin={(id) =>
                        setPinnedCommandIds(togglePinnedCommand(id))
                      }
                      tokens={tokensFor(s.id)}
                    />
                  ))}
                </CommandGroup>
              ) : null}
              <CommandGroup heading="Commands">
                {otherCommands
                  .filter((s) => !recentCommandSet.has(s.id))
                  .map((s) => (
                  <CommandActionItem
                    key={s.id}
                    id={s.id}
                    label={s.label}
                    pinned={pinnedCommandSet.has(s.id)}
                    onRun={handleSelectCommand}
                    onTogglePin={(id) => setPinnedCommandIds(togglePinnedCommand(id))}
                    tokens={tokensFor(s.id)}
                  />
                ))}
              </CommandGroup>
            </>
          ) : isSymbolMode ? (
            <CommandGroup heading="Symbols">
              {symbols.map((s, i) => (
                <CommandItem
                  key={`${s.name}-${i}`}
                  onSelect={() => handleSelectSymbol(s)}
                  value={s.name}
                >
                  <HugeiconsIcon
                    icon={
                      s.kind === "function"
                        ? FunctionIcon
                        : s.kind === "class" || s.kind === "interface"
                          ? PackageIcon
                          : CodeIcon
                    }
                    size={16}
                    className="mr-2 text-muted-foreground"
                  />
                  <span>{s.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Line {s.line}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : isSnippetMode ? (
            <CommandGroup heading="Snippets">
              {snippets
                .filter(
                  (s) =>
                    !effectiveQuery ||
                    s.label.toLowerCase().includes(effectiveQuery.toLowerCase()) ||
                    s.command.toLowerCase().includes(effectiveQuery.toLowerCase()),
                )
                .map((s) => (
                  <CommandItem
                    key={s.id}
                    onSelect={() => {
                      onRunTask(s.command);
                      onOpenChange(false);
                    }}
                    value={`${s.label} ${s.command}`}
                  >
                    <HugeiconsIcon
                      icon={QuillWrite01Icon}
                      size={16}
                      className="mr-2 text-muted-foreground"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">{s.label}</span>
                      <span className="max-w-[400px] truncate text-[10px] text-muted-foreground">
                        {s.command}
                      </span>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          ) : (
            <>
              {effectiveQuery.length < 2 && tasks.length > 0 ? (
                <CommandGroup heading="Tasks">
                  {tasks.map((task) => (
                    <CommandItem
                      key={`task:${task.name}`}
                      onSelect={() => handleSelectTask(task)}
                      value={`${task.name} ${task.command}`}
                    >
                      <HugeiconsIcon
                        icon={PackageIcon}
                        size={14}
                        strokeWidth={1.75}
                        className="mr-2 shrink-0 text-muted-foreground"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm">{task.name}</span>
                        <span className="max-w-[400px] truncate text-[10px] text-muted-foreground">
                          {task.source === "npm"
                            ? "package.json"
                            : task.source === "make"
                              ? "Makefile"
                              : "docker-compose"}{" "}
                          · {task.command}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {effectiveQuery.length < 2 && recentFiles.length > 0 ? (
                <CommandGroup heading="Recent Files">
                  {recentFiles.map((hit) => (
                    <FileItem
                      key={`recent:${hit.path}`}
                      hit={hit}
                      onSelect={handleSelectFile}
                    />
                  ))}
                </CommandGroup>
              ) : null}
              <CommandGroup heading="Files">
                {resultsToDisplay.map((hit) => (
                  <FileItem
                    key={hit.path}
                    hit={hit}
                    onSelect={handleSelectFile}
                  />
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function CommandActionItem({
  id,
  label,
  pinned,
  tokens,
  onRun,
  onTogglePin,
}: {
  id: ShortcutId;
  label: string;
  pinned: boolean;
  tokens: string[];
  onRun: (id: ShortcutId) => void;
  onTogglePin: (id: ShortcutId) => void;
}) {
  return (
    <CommandItem onSelect={() => onRun(id)} value={label}>
      <HugeiconsIcon icon={Search01Icon} size={16} className="mr-2" />
      <span className="flex-1">{label}</span>
      <div className="ml-auto flex w-34 items-center justify-end gap-2">
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(id);
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground"
          title={pinned ? "Unpin command" : "Pin command"}
          aria-label={pinned ? "Unpin command" : "Pin command"}
        >
          <span className={pinned ? "text-amber-500" : "opacity-65"}>
            {pinned ? "★" : "☆"}
          </span>
        </button>
        <CommandShortcut className="min-w-24 text-right">
          {tokens.join(" ")}
        </CommandShortcut>
      </div>
    </CommandItem>
  );
}

function FileItem({
  hit,
  onSelect,
}: {
  hit: SearchHit;
  onSelect: (hit: SearchHit) => void;
}) {
  const url = hit.is_dir ? null : fileIconUrl(hit.name);
  return (
    <CommandItem onSelect={() => onSelect(hit)} value={hit.rel}>
      {url ? (
        <img src={url} alt="" className="mr-2 size-4 shrink-0" />
      ) : (
        <HugeiconsIcon
          icon={Folder01Icon}
          size={14}
          strokeWidth={1.75}
          className="mr-2 shrink-0 text-muted-foreground"
        />
      )}
      <div className="flex flex-col">
        <span className="text-sm">{hit.name}</span>
        <span className="max-w-[400px] truncate text-[10px] text-muted-foreground">
          {hit.rel}
        </span>
      </div>
    </CommandItem>
  );
}
