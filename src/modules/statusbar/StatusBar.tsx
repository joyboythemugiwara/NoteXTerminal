import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  GitBranchIcon,
  Globe02Icon,
  IncognitoIcon,
  Link01Icon,
  Refresh01Icon,
  Tick01Icon,
  Wifi01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CwdBreadcrumb } from "./CwdBreadcrumb";
import { WorkspaceEnvSelector } from "./WorkspaceEnvSelector";
import type { WorkspaceEnv } from "@/modules/workspace";
import { useGitStore } from "@/modules/git/gitStore";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

type Props = {
  cwd: string | null;
  filePath?: string | null;
  home: string | null;
  onCd: (path: string) => void;
  onWorkspaceChange: (env: WorkspaceEnv) => void;
  liveServerAvailable?: boolean;
  liveServerRunning?: boolean;
  liveServerBusy?: boolean;
  onToggleLiveServer?: () => void;
  broadcastActive?: boolean;
  onToggleBroadcast?: () => void;
  privateActive: boolean;
};

export function StatusBar({
  cwd,
  filePath,
  home,
  onCd,
  onWorkspaceChange,
  liveServerAvailable = false,
  liveServerRunning = false,
  liveServerBusy = false,
  onToggleLiveServer,
  broadcastActive = false,
  onToggleBroadcast,
  privateActive,
}: Props) {
  const [discoveredPorts, setDiscoveredPorts] = useState<number[]>([]);
  const gitStatus = useGitStore((s) => s.status);
  const syncing = useGitStore((s) => s.syncing);
  const branches = useGitStore((s) => s.branches);
  const refreshGit = useGitStore((s) => s.refresh);
  const syncGit = useGitStore((s) => s.sync);
  const listBranches = useGitStore((s) => s.listBranches);
  const checkout = useGitStore((s) => s.checkout);

  useEffect(() => {
    // Editor tabs may not always provide a terminal cwd; fallback to the
    // active file path so git status remains visible while editing files.
    const target = cwd ?? filePath ?? null;
    if (!target) return;
    void refreshGit(target);
  }, [cwd, filePath, refreshGit]);

  const onOpenBranches = () => {
    void listBranches();
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const ports = await invoke<number[]>("discover_localhost");
        setDiscoveredPorts(ports);
      } catch (e) {
        console.error("localhost discovery failed:", e);
      }
    };
    void poll();
    const timer = setInterval(poll, 10000);
    return () => clearInterval(timer);
  }, []);

  const hasChanges = gitStatus && (gitStatus.modified.length > 0 || gitStatus.added.length > 0 || gitStatus.deleted.length > 0 || gitStatus.untracked.length > 0);

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-card/60 px-3 text-[11px]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <WorkspaceEnvSelector onSelect={onWorkspaceChange} />
        <CwdBreadcrumb cwd={cwd} filePath={filePath} home={home} onCd={onCd} />

        {gitStatus && (
          <div className="flex items-center gap-0 border-l border-border/60 ml-1 pl-2">
            <DropdownMenu onOpenChange={(open) => open && onOpenBranches()}>
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <HugeiconsIcon
                        icon={GitBranchIcon}
                        size={13}
                        strokeWidth={2}
                      />
                      <span className="max-w-40 truncate">
                        {gitStatus.branch}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <TooltipContent side="top" className="text-[11px]">
                    Switch branch (current: {gitStatus.branch})
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent
                align="start"
                className="min-w-48 max-h-80 overflow-y-auto"
              >
                <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/40 mb-1">
                  Branches
                </div>
                {branches.map((b) => (
                  <DropdownMenuItem
                    key={b}
                    onSelect={() => void checkout(b)}
                    className="gap-2"
                  >
                    <HugeiconsIcon
                      icon={b === gitStatus.branch ? Tick01Icon : GitBranchIcon}
                      size={12}
                      className={cn(
                        b === gitStatus.branch
                          ? "text-primary"
                          : "text-muted-foreground opacity-50",
                      )}
                    />
                    <span
                      className={cn(
                        "flex-1 truncate",
                        b === gitStatus.branch && "font-semibold",
                      )}
                    >
                      {b}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void syncGit();
                    }}
                    disabled={syncing}
                    className="flex shrink-0 items-center gap-0.5 px-1 py-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <HugeiconsIcon
                      icon={Refresh01Icon}
                      size={12}
                      className={cn(syncing && "animate-spin")}
                    />
                    {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                      <span className="flex items-center gap-0.5 ml-0.5">
                        {gitStatus.behind > 0 && (
                          <span className="flex items-center">
                            <HugeiconsIcon icon={ArrowDown01Icon} size={11} />
                            {gitStatus.behind}
                          </span>
                        )}
                        {gitStatus.ahead > 0 && (
                          <span className="flex items-center">
                            <HugeiconsIcon icon={ArrowUp01Icon} size={11} />
                            {gitStatus.ahead}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">
                  {syncing ? "Syncing..." : "Synchronize changes"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {hasChanges && (
              <div className="flex items-center gap-2 ml-1 px-1.5 text-muted-foreground cursor-default">
                {gitStatus.modified.length > 0 && (
                  <span
                    className="flex items-center gap-0.5"
                    title={`${gitStatus.modified.length} modified`}
                  >
                    <span className="text-[10px] font-bold">M</span>
                    {gitStatus.modified.length}
                  </span>
                )}
                {gitStatus.added.length > 0 && (
                  <span
                    className="flex items-center gap-0.5"
                    title={`${gitStatus.added.length} added`}
                  >
                    <span className="text-[10px] font-bold">A</span>
                    {gitStatus.added.length}
                  </span>
                )}
                {gitStatus.deleted.length > 0 && (
                  <span
                    className="flex items-center gap-0.5"
                    title={`${gitStatus.deleted.length} deleted`}
                  >
                    <span className="text-[10px] font-bold">D</span>
                    {gitStatus.deleted.length}
                  </span>
                )}
                {gitStatus.untracked.length > 0 && (
                  <span
                    className="flex items-center gap-0.5"
                    title={`${gitStatus.untracked.length} untracked`}
                  >
                    <span className="text-[10px] font-bold">?</span>
                    {gitStatus.untracked.length}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {privateActive ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex shrink-0 cursor-default items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-400">
                <HugeiconsIcon icon={IncognitoIcon} size={11} strokeWidth={2} />
                <span>Private session</span>
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-64 text-[11px] leading-relaxed"
            >
              This is a private terminal session.
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {discoveredPorts.map((port) => (
          <TooltipProvider key={port} delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    void openUrl(`http://localhost:${port}`).catch(console.error)
                  }
                  className="inline-flex h-5.5 items-center gap-1 rounded px-1.5 text-[10.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <HugeiconsIcon icon={Link01Icon} size={11} strokeWidth={1.9} />
                  <span>:{port}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px]">
                Open http://localhost:{port} in browser
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}

        {onToggleBroadcast && (
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleBroadcast}
                  className={cn(
                    "inline-flex h-5.5 items-center gap-1 rounded px-1.5 text-[10.5px] transition-colors",
                    broadcastActive
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <HugeiconsIcon icon={Wifi01Icon} size={11} strokeWidth={1.9} />
                  <span>Broadcast</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px]">
                {broadcastActive
                  ? "Stop broadcasting input to all panes"
                  : "Broadcast input to all panes in this tab"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {liveServerAvailable ? (
          <button
            type="button"
            onClick={onToggleLiveServer}
            disabled={liveServerBusy}
            className={cn(
              "inline-flex h-5.5 items-center gap-1 rounded px-1.5 text-[10.5px] transition-colors",
              liveServerRunning
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              liveServerBusy && "opacity-60",
            )}
            title={liveServerRunning ? "Stop Live Server" : "Start Live Server"}
          >
            <HugeiconsIcon icon={Globe02Icon} size={11} strokeWidth={1.9} />
            <span>
              {liveServerBusy
                ? "Live..."
                : liveServerRunning
                  ? "Stop Live"
                  : "Start Live"}
            </span>
          </button>
        ) : null}
      </div>
    </footer>
  );
}
