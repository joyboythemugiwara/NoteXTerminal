import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WindowControls } from "@/components/WindowControls";
import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import type { SettingsTab } from "@/modules/settings/openSettingsWindow";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  InformationCircleIcon,
  Settings01Icon,
  KeyboardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { JSX, useEffect, useState } from "react";
import { AboutSection } from "./sections/AboutSection";
import { GeneralSection } from "./sections/GeneralSection";
import { ShortcutsSection } from "./sections/ShortcutsSection";

const TABS: {
  id: SettingsTab;
  label: string;
  icon: typeof Settings01Icon;
  component: () => JSX.Element;
}[] = [
  {
    id: "general",
    label: "General",
    icon: Settings01Icon,
    component: GeneralSection,
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: KeyboardIcon,
    component: ShortcutsSection,
  },
  {
    id: "about",
    label: "About",
    icon: InformationCircleIcon,
    component: AboutSection,
  },
];

const VALID_TABS: SettingsTab[] = ["general", "shortcuts", "about"];

function readInitialTab(): SettingsTab {
  if (typeof window === "undefined") return "general";
  const url = new URL(window.location.href);
  const t = url.searchParams.get("tab");
  if (t && (VALID_TABS as string[]).includes(t)) return t as SettingsTab;
  return "general";
}

export function SettingsApp() {
  const [active, setActive] = useState<SettingsTab>(readInitialTab);
  const init = usePreferencesStore((s) => s.init);
  const ActiveSection = TABS.find((t) => t.id === active)?.component;

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const apply = (detail: string) => {
      if ((VALID_TABS as string[]).includes(detail)) {
        setActive(detail as SettingsTab);
      }
    };
    const unlistenPromise = getCurrentWebviewWindow().listen<string>(
      "notex:settings-tab",
      (e) => apply(e.payload),
    );
    return () => {
      void unlistenPromise.then((un) => un());
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground select-none">
      <header
        data-tauri-drag-region
        className={`flex h-12 shrink-0 items-center border-b border-border/60 bg-card/70 backdrop-blur ${
          IS_MAC ? "pr-3 pl-22" : "pr-0 pl-2 sm:pl-3"
        }`}
      >
        <Tabs
          value={active}
          onValueChange={(v) => setActive(v as SettingsTab)}
          orientation="horizontal"
          className="min-w-0 flex-1 items-center"
          data-tauri-drag-region
        >
          <TabsList className="mx-auto h-8 w-full max-w-md rounded-xl border border-border/50 bg-muted/40 px-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="h-6.5 flex-1 gap-1 rounded-lg px-1.5 text-[11px] sm:gap-1.5 sm:px-3 sm:text-[11.5px]"
              >
                <HugeiconsIcon icon={t.icon} size={12} strokeWidth={1.75} />
                <span>{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {USE_CUSTOM_WINDOW_CONTROLS && <WindowControls closeOnly />}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-border/60 bg-card/35 p-4 shadow-sm sm:p-6">
          {ActiveSection && <ActiveSection />}
        </div>
      </main>
    </div>
  );
}
