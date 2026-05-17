import {
  findNext,
  findPrevious,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { keymap } from "@codemirror/view";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EDITOR_THEME_EXT } from "./lib/themes";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ViewSidebarRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MarkdownPreview } from "./MarkdownPreview";
import { HtmlPreview } from "./HtmlPreview";
import { JsonPreview } from "./JsonPreview";
import { CssPreview } from "./CssPreview";
import { CsvPreview } from "./CsvPreview";
import { ImagePreview } from "./ImagePreview";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Prec } from "@codemirror/state";
import { vim } from "@replit/codemirror-vim";
import {
  buildSharedExtensions,
  languageCompartment,
  vimCompartment,
} from "./lib/extensions";
import { initVimGlobals, vimHandlersExtension } from "./lib/vim";

initVimGlobals();
import { resolveLanguage } from "./lib/languageResolver";
import { useDocument } from "./lib/useDocument";

export type EditorPaneHandle = {
  setQuery: (q: string) => void;
  findNext: () => void;
  findPrevious: () => void;
  clearQuery: () => void;
  focus: () => void;
  getSelection: () => string | null;
  getPath: () => string;
  gotoLine: (line: number) => void;
  /** Re-read the file from disk. Skips silently if the buffer is dirty. */
  reload: () => boolean;
};

type Props = {
  path: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
  onClose?: () => void;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function isMarkdownPath(path: string): boolean {
  const normalized = path.trim();
  return /\.(md|mdx|markdown|mdown|mkd)(?:$|[?#])/i.test(normalized);
}

function isHtmlPath(path: string): boolean {
  const normalized = path.trim();
  return /\.(html|htm)(?:$|[?#])/i.test(normalized);
}

function isJsonPath(path: string): boolean {
  const normalized = path.trim();
  return /\.json(?:$|[?#])/i.test(normalized);
}

function isCssPath(path: string): boolean {
  const normalized = path.trim();
  return /\.css(?:$|[?#])/i.test(normalized);
}

function isCsvPath(path: string): boolean {
  const normalized = path.trim();
  return /\.csv(?:$|[?#])/i.test(normalized);
}

function isImagePath(path: string): boolean {
  const normalized = path.trim();
  return /\.(png|jpg|jpeg|gif|webp|ico|bmp)(?:$|[?#])/i.test(normalized);
}

function isSvgPath(path: string): boolean {
  const normalized = path.trim();
  return /\.svg(?:$|[?#])/i.test(normalized);
}

export const EditorPane = forwardRef<EditorPaneHandle, Props>(
  function EditorPane({ path, onDirtyChange, onSaved, onClose }, ref) {
    const { doc, onChange, save, reload } = useDocument({ path, onDirtyChange });
    const reloadRef = useRef(reload);
    reloadRef.current = reload;
    const cmRef = useRef<ReactCodeMirrorRef>(null);
    const editorThemeId = usePreferencesStore((s) => s.editorTheme);
    const vimMode = usePreferencesStore((s) => s.vimMode);

    const [content, setContent] = useState("");
    const [showPreview, setShowPreview] = useState(false);

    const isMarkdown = isMarkdownPath(path);
    const isHtml = isHtmlPath(path);
    const isJson = isJsonPath(path);
    const isCss = isCssPath(path);
    const isCsv = isCsvPath(path);
    const isImage = isImagePath(path);
    const isSvg = isSvgPath(path);

    const isPreviewSupported =
      doc.status === "ready" &&
      !["binary", "toolarge", "error"].includes(doc.status) &&
      (isMarkdown || isHtml || isJson || isCss || isCsv || isSvg);

    useEffect(() => {
      if (doc.status === "ready") {
        setContent(doc.content);
      }
    }, [doc.status, doc]);

    const handleContentChange = useCallback(
      (val: string) => {
        onChange(val);
        setContent(val);
      },
      [onChange],
    );

    const themeExt = EDITOR_THEME_EXT[editorThemeId] ?? EDITOR_THEME_EXT.atomone;

    const saveRef = useRef(save);
    saveRef.current = save;
    const onSavedRef = useRef(onSaved);
    onSavedRef.current = onSaved;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const extensions = useMemo(
      () => [
        vimCompartment.of(
          usePreferencesStore.getState().vimMode ? Prec.highest(vim()) : [],
        ),
        vimHandlersExtension(() => ({
          save: () => {
            void (async () => {
              await saveRef.current();
              onSavedRef.current?.();
            })();
          },
          close: () => onCloseRef.current?.(),
        })),
        ...buildSharedExtensions(),
        languageCompartment.of([]),
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              void (async () => {
                await saveRef.current();
                onSavedRef.current?.();
              })();
              return true;
            },
          },
        ]),
      ],
      [],
    );

    useEffect(() => {
      const view = cmRef.current?.view;
      if (!view) return;
      view.dispatch({
        effects: vimCompartment.reconfigure(
          vimMode ? Prec.highest(vim()) : [],
        ),
      });
    }, [vimMode]);

    useEffect(() => {
      let cancelled = false;
      resolveLanguage(path).then((ext) => {
        if (cancelled) return;
        const view = cmRef.current?.view;
        if (!view) return;
        view.dispatch({
          effects: languageCompartment.reconfigure(ext ?? []),
        });
      });
      return () => {
        cancelled = true;
      };
    }, [path, doc.status]);

    useImperativeHandle(
      ref,
      () => ({
        setQuery: (q: string) => {
          const view = cmRef.current?.view;
          if (!view) return;
          view.dispatch({
            effects: setSearchQuery.of(
              new SearchQuery({ search: q, caseSensitive: false }),
            ),
          });
          if (q) findNext(view);
        },
        findNext: () => {
          const view = cmRef.current?.view;
          if (view) findNext(view);
        },
        findPrevious: () => {
          const view = cmRef.current?.view;
          if (view) findPrevious(view);
        },
        clearQuery: () => {
          const view = cmRef.current?.view;
          if (!view) return;
          view.dispatch({
            effects: setSearchQuery.of(new SearchQuery({ search: "" })),
          });
        },
        focus: () => {
          cmRef.current?.view?.focus();
        },
        getSelection: () => {
          const view = cmRef.current?.view;
          if (!view) return null;
          const { from, to } = view.state.selection.main;
          if (from === to) return null;
          return view.state.sliceDoc(from, to);
        },
        getPath: () => path,
        gotoLine: (line: number) => {
          const view = cmRef.current?.view;
          if (!view) return;
          try {
            const pos = view.state.doc.line(line).from;
            view.dispatch({
              selection: { anchor: pos, head: pos },
              scrollIntoView: true,
            });
            view.focus();
          } catch (e) {
            console.error("gotoLine failed", e);
          }
        },
        reload: () => reloadRef.current(),
      }),
      [path],
    );

    if (doc.status === "loading") {
      return (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          Loading…
        </div>
      );
    }
    if (doc.status === "error") {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-xs text-destructive">
          {doc.message}
        </div>
      );
    }
    if (doc.status === "binary") {
      if (isImage) {
        return <ImagePreview path={path} />;
      }
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
          <div className="text-sm text-foreground">Binary file</div>
          <div className="text-xs text-muted-foreground">
            {formatBytes(doc.size)} · preview not supported
          </div>
        </div>
      );
    }
    if (doc.status === "toolarge") {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
          <div className="text-sm text-foreground">File too large</div>
          <div className="text-xs text-muted-foreground">
            {formatBytes(doc.size)} exceeds the {formatBytes(doc.limit)} limit.
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        {isPreviewSupported && (
          <div className="flex h-8 shrink-0 items-center justify-end border-b border-border/60 bg-card px-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors",
                showPreview
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Toggle Preview"
            >
              <HugeiconsIcon
                icon={ViewSidebarRightIcon}
                size={14}
                strokeWidth={1.75}
              />
              Preview
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0">
          {isPreviewSupported && showPreview ? (
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize={50} minSize={20}>
                <CodeMirror
                  ref={cmRef}
                  value={doc.status === "ready" ? doc.content : ""}
                  onChange={handleContentChange}
                  theme={themeExt}
                  extensions={extensions}
                  height="100%"
                  className="h-full"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    foldGutter: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    searchKeymap: true,
                  }}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={20}>
                {isMarkdown && <MarkdownPreview content={content} />}
                {(isHtml || isSvg) && <HtmlPreview content={content} />}
                {isJson && <JsonPreview content={content} />}
                {isCss && <CssPreview content={content} />}
                {isCsv && <CsvPreview content={content} />}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <CodeMirror
              ref={cmRef}
              value={doc.status === "ready" ? doc.content : ""}
              onChange={handleContentChange}
              theme={themeExt}
              extensions={extensions}
              height="100%"
              className="h-full"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                foldGutter: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                searchKeymap: true,
              }}
            />
          )}
        </div>
      </div>
    );
  },
);
