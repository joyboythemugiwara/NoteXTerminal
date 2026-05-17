import { convertFileSrc } from "@tauri-apps/api/core";
import { useMemo } from "react";

type Props = {
  path: string;
};

export function ImagePreview({ path }: Props) {
  const src = useMemo(() => convertFileSrc(path), [path]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-card/50 p-8">
      <img
        src={src}
        alt="Preview"
        className="max-h-full max-w-full object-contain shadow-lg"
      />
    </div>
  );
}
