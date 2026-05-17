/**
 * Quotes a file path for use as a shell argument.
 * Handles differences between POSIX (bash/zsh) and Windows (PowerShell/cmd).
 */
export function quotePath(path: string): string {
  // Strip control characters (CR, LF, NUL) to prevent terminal injection.
  const clean = path.replace(/[\r\n\0]/g, "");

  // Heuristic for Windows-style paths (drive letter or UNC).
  const isWindowsPath = /^[a-zA-Z]:\\|^\\\\/.test(clean);

  if (isWindowsPath) {
    // PowerShell quoting: Double quotes with backtick escaping for existing quotes.
    const escaped = clean.replace(/"/g, '`"');
    return `"${escaped}"`;
  } else {
    // POSIX quoting: Single quotes with internal quote handling.
    // 'foo'bar' -> 'foo'\''bar'
    const escaped = clean.replace(/'/g, "'\\''");
    return `'${escaped}'`;
  }
}

/**
 * Takes an array of paths and returns a space-separated string of quoted paths.
 */
export function quotePaths(paths: string[]): string {
  return paths.map(quotePath).join(" ");
}
