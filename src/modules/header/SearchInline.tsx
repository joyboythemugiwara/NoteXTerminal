import { Button } from "@/components/ui/button";
import { KEY_SEP } from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { EditorPaneHandle } from "@/modules/editor";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { getBindingTokens, SHORTCUTS } from "@/modules/shortcuts/shortcuts";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SearchAddon } from "@xterm/addon-search";
import { AnimatePresence, motion } from "motion/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

const TERM_DECORATIONS = {
  matchBackground: "#515c6a",
  activeMatchBackground: "#d18616",
  matchOverviewRuler: "#d18616",
  activeMatchColorOverviewRuler: "#d18616",
};

export type SearchResults = {
  index: number;
  count: number;
};

export type SearchOptions = {
  regex?: boolean;
  wholeWord?: boolean;
  caseSensitive?: boolean;
};

export type SearchTarget =
  | {
      kind: "terminal";
      addon: SearchAddon;
      focus: () => void;
      onResults?: (cb: (r: SearchResults) => void) => () => void;
    }
  | {
      kind: "editor";
      handle: EditorPaneHandle;
      focus: () => void;
    }
  | null;

export type SearchInlineHandle = {
  focus: () => void;
  setResults: (results: SearchResults) => void;
};

type Props = {
  target: SearchTarget;
  /** When true, collapse to an icon-only button until the user opens it. */
  compact?: boolean;
};

export const SearchInline = forwardRef<SearchInlineHandle, Props>(
  function SearchInline({ target, compact }, ref) {
    const [q, setQ] = useState("");
    const [results, setResults] = useState<SearchResults>({ index: -1, count: 0 });
    const [options, setOptions] = useState<SearchOptions>({
      regex: false,
      caseSensitive: false,
      wholeWord: false,
    });
    // In compact mode the field is hidden behind an icon until activated.
    // In normal mode the field is always present.
    const [openInCompact, setOpenInCompact] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const pendingFocusRef = useRef(false);
    const setInputRef = useCallback((el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (!el || !pendingFocusRef.current) return;
      pendingFocusRef.current = false;
      el.focus();
    }, []);

    const userShortcuts = usePreferencesStore((s) => s.shortcuts);

    const shortcutText = useMemo(() => {
      const s = SHORTCUTS.find((s) => s.id === "search.focus");
      if (!s) return "";
      const bindings = userShortcuts["search.focus"] || s.defaultBindings;
      if (!bindings || bindings.length === 0) return "";
      const tokens = getBindingTokens(bindings[0]);
      return tokens.join(KEY_SEP);
    }, [userShortcuts]);

    const placeholder = useMemo(() => {
      return shortcutText ? `Search (${shortcutText})` : "Search";
    }, [shortcutText]);

    const tooltipTitle = useMemo(() => {
      return shortcutText ? `Search (${shortcutText})` : "Search";
    }, [shortcutText]);

    const expanded = !compact || openInCompact;

    const focus = useCallback(() => {
      pendingFocusRef.current = true;
      if (compact) setOpenInCompact(true);
      else inputRef.current?.focus();
      if (inputRef.current) pendingFocusRef.current = false;
    }, [compact]);

    useImperativeHandle(ref, () => ({ focus, setResults }), [focus]);

    const clearTarget = useCallback(() => {
      if (!target) return;
      if (target.kind === "terminal") target.addon.clearDecorations();
      else target.handle.clearQuery();
    }, [target]);

    const restoreTargetFocus = useCallback(() => {
      if (!target) return;
      target.focus();
    }, [target]);

    // Target switched (terminal ↔ editor) or removed → drop highlights.
    useEffect(() => {
      clearTarget();
      setResults({ index: -1, count: 0 });

      if (target?.kind === "terminal" && target.onResults) {
        return target.onResults(setResults);
      }
    }, [target, clearTarget]);

    const applyIncremental = (next: string, opts: SearchOptions = options) => {
      if (!target) return;
      if (target.kind === "terminal") {
        if (next) {
          target.addon.findNext(next, {
            incremental: true,
            decorations: TERM_DECORATIONS,
            regex: opts.regex,
            caseSensitive: opts.caseSensitive,
            wholeWord: opts.wholeWord,
          });
        } else {
          target.addon.clearDecorations();
          setResults({ index: -1, count: 0 });
        }
      } else {
        target.handle.setQuery(next);
      }
    };

    const findDirection = (forward: boolean, opts: SearchOptions = options) => {
      if (!target || !q) return;
      if (target.kind === "terminal") {
        const findOpts = {
          decorations: TERM_DECORATIONS,
          regex: opts.regex,
          caseSensitive: opts.caseSensitive,
          wholeWord: opts.wholeWord,
        };
        if (forward) target.addon.findNext(q, findOpts);
        else target.addon.findPrevious(q, findOpts);
      } else {
        if (forward) target.handle.findNext();
        else target.handle.findPrevious();
      }
    };

    const toggleOption = (key: keyof SearchOptions) => {
      const next = { ...options, [key]: !options[key] };
      setOptions(next);
      if (q) applyIncremental(q, next);
    };

    return (
      <motion.div
        layout
        initial={false}
        animate={{ width: expanded ? 320 : 28 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="relative h-7 shrink-0"
      >
        <AnimatePresence initial={false} mode="wait">
          {expanded ? (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex h-full items-center gap-1 rounded-md bg-muted/80 px-1.5 shadow-sm"
            >
              <HugeiconsIcon
                icon={Search01Icon}
                size={13}
                strokeWidth={1.75}
                className="text-muted-foreground/70"
              />
              <div className="relative flex-1">
                <input
                  ref={setInputRef}
                  value={q}
                  placeholder={placeholder}
                  className="h-6 w-full border-none bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground/50"
                  onChange={(e) => {
                    const next = e.target.value;
                    setQ(next);
                    applyIncremental(next);
                  }}
                  onBlur={() => {
                    if (compact && !q) setOpenInCompact(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      findDirection(!e.shiftKey);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      clearTarget();
                      setQ("");
                      if (compact) {
                        setOpenInCompact(false);
                      }
                      restoreTargetFocus();
                    }
                  }}
                />
              </div>

              {q && (
                <div className="flex shrink-0 items-center gap-0.5 border-r border-border/40 pr-1 mr-1">
                  <span className="px-1 text-[11px] tabular-nums text-muted-foreground/80">
                    {results.count > 0
                      ? `${results.index + 1}/${results.count}`
                      : "0/0"}
                  </span>
                  <button
                    type="button"
                    onClick={() => findDirection(false)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Previous match (Shift+Enter)"
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => findDirection(true)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Next match (Enter)"
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
                  </button>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => toggleOption("caseSensitive")}
                  className={cn(
                    "flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold transition-colors",
                    options.caseSensitive
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground/60 hover:bg-accent hover:text-foreground",
                  )}
                  title="Match Case"
                >
                  Aa
                </button>
                <button
                  type="button"
                  onClick={() => toggleOption("regex")}
                  className={cn(
                    "flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold transition-colors",
                    options.regex
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground/60 hover:bg-accent hover:text-foreground",
                  )}
                  title="Use Regular Expression"
                >
                  .*
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    clearTarget();
                    if (compact) setOpenInCompact(false);
                    restoreTargetFocus();
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Close search"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={11}
                    strokeWidth={2}
                  />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0 flex items-center justify-end"
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={focus}
                title={tooltipTitle}
              >
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={15}
                  strokeWidth={1.75}
                />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  },
);
