import { useMemo } from "react";

type Props = {
  content: string;
};

export function CsvPreview({ content }: Props) {
  const rows = useMemo(() => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
    return lines.map((line) => {
      // Simple CSV parser that handles quotes
      const result = [];
      let start = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        if (line[i] === "," && !inQuotes) {
          result.push(line.substring(start, i).replace(/^"|"$/g, ""));
          start = i + 1;
        }
      }
      result.push(line.substring(start).replace(/^"|"$/g, ""));
      return result;
    });
  }, [content]);

  if (rows.length === 0) return <div className="p-4 text-xs">Empty CSV</div>;

  const header = rows[0];
  const data = rows.slice(1);

  return (
    <div className="h-full w-full overflow-auto bg-card">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
          <tr>
            {header.map((col, i) => (
              <th
                key={i}
                className="border-b border-border/60 px-4 py-2 font-semibold"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-accent/50">
              {row.map((cell, j) => (
                <th
                  key={j}
                  className="border-b border-border/40 px-4 py-2 font-normal text-muted-foreground"
                >
                  {cell}
                </th>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
