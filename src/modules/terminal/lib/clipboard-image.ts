import { invoke } from "@tauri-apps/api/core";

/**
 * Checks if a DataTransfer object (from a paste event) contains an image,
 * and if so, saves it to the app cache and returns the file path.
 */
export async function tryHandleClipboardImage(
  dt: DataTransfer,
): Promise<string | null> {
  const items = Array.from(dt.items);
  const imageItem = items.find((item) => item.type.startsWith("image/"));

  if (!imageItem) return null;

  const file = imageItem.getAsFile();
  if (!file) return null;

  const arrayBuffer = await file.arrayBuffer();
  const data = Array.from(new Uint8Array(arrayBuffer));

  try {
    const path = await invoke<string>("fs_write_clipboard_image", {
      data,
      mime: file.type,
    });
    return path;
  } catch (e) {
    console.error("failed to save clipboard image", e);
    return null;
  }
}
