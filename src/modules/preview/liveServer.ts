import { invoke } from "@tauri-apps/api/core";
import { currentWorkspaceEnv } from "@/modules/workspace";

type BgInfo = {
  handle: number;
  command: string;
  cwd: string | null;
  started_at_ms: number;
  exited: boolean;
  exit_code: number | null;
};

type ReadResult =
  | { kind: "text"; content: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number; limit: number };

const MIN_PORT = 5500;
const MAX_PORT = 5599;
const livePortByRoot = new Map<string, number>();

function normalizeRoot(rootPath: string): string {
  return rootPath.endsWith("/") ? rootPath.slice(0, -1) : rootPath;
}

async function probe(url: string): Promise<boolean> {
  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(700),
    });
    return true;
  } catch {
    return false;
  }
}

async function findHandleForRoot(rootPath: string): Promise<number | null> {
  const list = await invoke<BgInfo[]>("shell_bg_list");
  const normalized = normalizeRoot(rootPath);
  for (const p of list) {
    if (p.exited) continue;
    if (!p.command.includes("__TERAX_LIVE_SERVER__")) continue;
    if (p.command.includes(`__TERAX_LIVE_SERVER_ROOT__=${normalized}`)) {
      return p.handle;
    }
  }
  return null;
}

async function findFreePort(): Promise<number> {
  for (let p = MIN_PORT; p <= MAX_PORT; p++) {
    const ok = await probe(`http://localhost:${p}`);
    if (!ok) return p;
  }
  throw new Error("No free port found in range 5500-5599");
}

async function resolvePortForRoot(rootPath: string): Promise<number> {
  const preferred = livePortByRoot.get(rootPath);
  if (preferred !== undefined) {
    const occupied = await probe(`http://localhost:${preferred}`);
    if (!occupied) return preferred;
  }
  return findFreePort();
}

async function pickEntryUrl(rootPath: string, port: number): Promise<string> {
  const workspace = currentWorkspaceEnv();
  const root = normalizeRoot(rootPath);
  const indexHtml = `${root}/index.html`;
  const indexHtm = `${root}/index.htm`;
  const hasIndexHtml = await invoke("fs_stat", {
    path: indexHtml,
    workspace,
  })
    .then(() => true)
    .catch(() => false);
  if (hasIndexHtml) return `http://localhost:${port}/index.html`;

  const hasIndexHtm = await invoke("fs_stat", {
    path: indexHtm,
    workspace,
  })
    .then(() => true)
    .catch(() => false);
  if (hasIndexHtm) return `http://localhost:${port}/index.htm`;

  return `http://localhost:${port}/`;
}

async function pathExists(path: string): Promise<boolean> {
  return invoke("fs_stat", { path, workspace: currentWorkspaceEnv() })
    .then(() => true)
    .catch(() => false);
}

async function resolveServeRoot(rootPath: string): Promise<{ serveRoot: string; mode: "plain" | "vite-dist" }> {
  const root = normalizeRoot(rootPath);
  const packageJsonPath = `${root}/package.json`;
  const packageJson = await invoke<ReadResult>("fs_read_file", {
    path: packageJsonPath,
    workspace: currentWorkspaceEnv(),
  }).catch(() => null);

  let isViteProject = false;
  if (packageJson && packageJson.kind === "text") {
    try {
      const parsed = JSON.parse(packageJson.content) as {
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };
      isViteProject = Boolean(parsed.devDependencies?.vite || parsed.dependencies?.vite);
    } catch {
      // ignore parse errors
    }
  }

  if (!isViteProject) return { serveRoot: root, mode: "plain" };

  const distIndexHtml = `${root}/dist/index.html`;
  const hasDist = await pathExists(distIndexHtml);
  if (!hasDist) {
    throw new Error(
      "Vite project detected. Live Server serves static files only. Run `bun run dev` (recommended) or `bun run build` first.",
    );
  }
  return { serveRoot: `${root}/dist`, mode: "vite-dist" };
}

export async function startLiveServer(
  rootPath: string,
): Promise<{ handle: number; url: string; mode: "plain" | "vite-dist" }> {
  const normalizedRoot = normalizeRoot(rootPath);
  const existing = await findHandleForRoot(normalizedRoot);
  if (existing !== null) {
    const knownPort = livePortByRoot.get(normalizedRoot) ?? 5500;
    const url = await pickEntryUrl(normalizedRoot, knownPort);
    return { handle: existing, url, mode: "plain" };
  }

  const { serveRoot, mode } = await resolveServeRoot(normalizedRoot);
  const port = await resolvePortForRoot(normalizedRoot);
  const cmd =
    `echo __TERAX_LIVE_SERVER__:${port}; ` +
    `echo __TERAX_LIVE_SERVER_ROOT__=${normalizedRoot}; ` +
    `if command -v python3 >/dev/null 2>&1; then python3 -m http.server ${port}; ` +
    `elif command -v python >/dev/null 2>&1; then python -m http.server ${port}; ` +
    `else echo 'python not found'; exit 127; fi`;
  const handle = await invoke<number>("shell_bg_spawn", {
    command: cmd,
    cwd: serveRoot,
    workspace: currentWorkspaceEnv(),
  });
  livePortByRoot.set(normalizedRoot, port);
  const url = await pickEntryUrl(normalizedRoot, port);
  return { handle, url, mode };
}

export async function stopLiveServer(rootPath: string): Promise<void> {
  const normalizedRoot = normalizeRoot(rootPath);
  const handle = await findHandleForRoot(normalizedRoot);
  if (handle !== null) await invoke("shell_bg_kill", { handle });
}

export async function isLiveServerRunning(rootPath: string): Promise<boolean> {
  return (await findHandleForRoot(rootPath)) !== null;
}
