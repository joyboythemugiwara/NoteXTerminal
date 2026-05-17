import { cn } from "@/lib/utils";
import type { ApiClientTab, Tab } from "@/modules/tabs";
import { ApiClientPane } from "./ApiClientPane";

type Props = {
  tabs: Tab[];
  activeId: number;
};

export function ApiClientStack({ tabs, activeId }: Props) {
  const clients = tabs.filter((t): t is ApiClientTab => t.kind === "api-client");

  if (clients.length === 0) return null;

  return (
    <div className="relative h-full w-full bg-background">
      {clients.map((t) => {
        const visible = t.id === activeId;
        return (
          <div
            key={t.id}
            className={cn(
              "absolute inset-0 flex flex-col",
              !visible && "invisible pointer-events-none",
            )}
            aria-hidden={!visible}
          >
            <ApiClientPane />
          </div>
        );
      })}
    </div>
  );
}
