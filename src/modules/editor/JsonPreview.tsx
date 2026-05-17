import { useMemo } from "react";

type Props = {
  content: string;
};

export function JsonPreview({ content }: Props) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch (e) {
      return { error: "Invalid JSON", message: String(e) };
    }
  }, [content]);

  const formatted = useMemo(() => {
    try {
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return "Error formatting JSON";
    }
  }, [parsed]);

  return (
    <div className="h-full w-full overflow-auto bg-card p-4 font-mono text-xs">
      <pre className="text-foreground">{formatted}</pre>
    </div>
  );
}
