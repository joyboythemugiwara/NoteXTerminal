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
import { Textarea } from "@/components/ui/textarea";
import { QuillWrite01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { addSnippet } from "./snippetStore";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewSnippetDialog({ open, onOpenChange }: Props) {
  const [label, setLabel] = useState("");
  const [command, setCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLabel("");
      setCommand("");
      setError(null);
      setTimeout(() => labelRef.current?.focus(), 0);
    }
  }, [open]);

  const submit = async () => {
    const trimmedLabel = label.trim();
    const trimmedCommand = command.trim();

    if (!trimmedLabel) {
      setError("Label is required");
      return;
    }
    if (!trimmedCommand) {
      setError("Command is required");
      return;
    }

    try {
      await addSnippet(trimmedLabel, trimmedCommand);
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
            <HugeiconsIcon
              icon={QuillWrite01Icon}
              size={18}
              strokeWidth={1.75}
            />
            Create snippet
          </DialogTitle>
          <DialogDescription>
            Save a frequently used command for quick access.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="snippet-label" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Label
            </Label>
            <Input
              id="snippet-label"
              ref={labelRef}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setError(null);
              }}
              placeholder="e.g., Run Dev Server"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="snippet-command" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Command
            </Label>
            <Textarea
              id="snippet-command"
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                setError(null);
              }}
              placeholder="e.g., bun run dev"
              className="min-h-20 font-mono text-[12px]"
            />
          </div>

          {error && (
            <div className="text-[11px] text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Save Snippet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
