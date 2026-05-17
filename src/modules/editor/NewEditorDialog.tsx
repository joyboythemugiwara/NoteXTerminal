import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilePlusIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { currentWorkspaceEnv } from "@/modules/workspace";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootPath: string | null;
  onCreated: (path: string) => void;
};

function joinPath(parent: string, name: string): string {
  if (parent.endsWith("/")) return `${parent}${name}`;
  return `${parent}/${name}`;
}

export function NewEditorDialog({
  open,
  onOpenChange,
  rootPath,
  onCreated,
}: Props) {
  const [name, setName] = useState("untitled.txt");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("untitled.txt");
    setError(null);
    // Pre-select the basename so the user can quickly retype the filename
    // while keeping the extension handy.
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const dot = el.value.lastIndexOf(".");
      el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
    }, 0);
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (trimmed.includes("..")) {
      setError("Path must be relative");
      return;
    }
    if (!rootPath) {
      setError("No workspace root");
      return;
    }
    const path = trimmed.startsWith("/")
      ? trimmed
      : joinPath(rootPath, trimmed);
    try {
      await invoke("fs_create_file", { path, workspace: currentWorkspaceEnv() });
      onCreated(path);
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.75">
            <HugeiconsIcon icon={FilePlusIcon} size={18} strokeWidth={1.75} />
            New file
          </DialogTitle>
          <DialogDescription>
            The extension determines the language mode and available features.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="new-file-name"
              className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              File name
            </Label>
            <Input
              id="new-file-name"
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="example.ts"
            />
          </div>

          {error ? (
            <div className="text-[11px] text-destructive">{error}</div>
          ) : (
            <div className="truncate text-[11px] text-muted-foreground">
              <span className="opacity-50">Path: </span>
              {rootPath ? joinPath(rootPath, name.trim() || "…") : "—"}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Create File</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
