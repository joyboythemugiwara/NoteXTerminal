import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingRow({ title, description, children, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:gap-5 sm:px-4 sm:py-3.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] font-medium tracking-tight">{title}</span>
        {description ? (
          <span className="text-[11.5px] leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      <div className="flex w-full items-center justify-start sm:w-auto sm:shrink-0 sm:justify-end">
        {children}
      </div>
    </div>
  );
}
