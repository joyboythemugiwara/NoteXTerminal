import { useTheme } from "@/modules/theme";
import type { SearchAddon } from "@xterm/addon-search";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useTerminalSession } from "./lib/useTerminalSession";

export type TerminalPaneHandle = {
  write: (data: string) => void;
  focus: () => void;
  getBuffer: (maxLines?: number) => string | null;
  getSelection: () => string | null;
};

type Props = {
  /** Stable identifier for this leaf (passed back through callbacks). */
  leafId: number;
  /** Tab containing this pane is on screen. */
  visible: boolean;
  /** This leaf is the active pane within its tab — receives auto-focus. */
  focused?: boolean;
  initialCwd?: string;
  onSearchReady?: (leafId: number, addon: SearchAddon) => void;
  onResults?: (
    leafId: number,
    results: { index: number; count: number },
  ) => void;
  onExit?: (leafId: number, code: number) => void;
  onCwd?: (leafId: number, cwd: string) => void;
};

export const TerminalPane = forwardRef<TerminalPaneHandle, Props>(
  function TerminalPane(
    {
      leafId,
      visible,
      focused = true,
      initialCwd,
      onSearchReady,
      onResults,
      onExit,
      onCwd,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useTheme();

    const session = useTerminalSession({
      leafId,
      container: containerRef,
      visible,
      focused,
      initialCwd,
      onSearchReady: (a) => onSearchReady?.(leafId, a),
      onResults: (r) => onResults?.(leafId, r),
      onExit: (c) => onExit?.(leafId, c),
      onCwd: (c) => onCwd?.(leafId, c),
    });

    useEffect(() => {
      // Defer one frame so CSS-variable token resolution sees the new class.
      const id = requestAnimationFrame(() => session.applyTheme());
      return () => cancelAnimationFrame(id);
    }, [resolvedTheme, session]);

    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => session.write(data),
        focus: () => session.focus(),
        getBuffer: (max?: number) => session.getBuffer(max),
        getSelection: () => session.getSelection(),
      }),
      [session],
    );

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      let path = e.dataTransfer.getData("text/plain");
      
      if (!path && e.dataTransfer.files.length > 0) {
        // This is a file from the OS. In some environments, webview might not 
        // give the full path due to security. But in Tauri it usually does if
        // configured. 
        // Actually, better to use Tauri's native drag-drop if possible, 
        // but let's try this first.
        path = (e.dataTransfer.files[0] as any).path || e.dataTransfer.files[0].name;
      }

      if (path) {
        const quoted = path.includes(" ") ? `"${path}"` : path;
        session.write(quoted);
        session.focus();
      }
    };

    return (
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="zoom-exempt h-full w-full"
        style={{
          visibility: visible ? "visible" : "hidden",
          pointerEvents: visible ? "auto" : "none",
        }}
      />
    );
  },
);
