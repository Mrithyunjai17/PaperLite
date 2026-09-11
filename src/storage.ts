import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";

export interface OpenedPdf {
  name: string;
  path?: string;
  bytes: Uint8Array;
}

const isTauri = () => "__TAURI_INTERNALS__" in window;

export async function choosePdf(): Promise<OpenedPdf | null> {
  if (isTauri()) {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    if (!path) return null;
    const bytes = await readFile(path);
    return { name: path.split(/[\\/]/).pop() ?? "Document.pdf", path, bytes };
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    };
    input.click();
  });
}

export async function savePdf(bytes: Uint8Array, suggestedName: string) {
  if (isTauri()) {
    const path = await save({
      defaultPath: suggestedName,
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }

  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
