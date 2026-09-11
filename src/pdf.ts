import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Annotation, SearchResult } from "./types";

export function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const number = Number.parseInt(clean, 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
}

export async function applyAnnotations(source: Uint8Array, annotations: Annotation[]) {
  const document = await PDFDocument.load(source);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = document.getPages();

  const toPdfPoint = (point: { x: number; y: number }, width: number, height: number, rotation: number) => {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    if (normalizedRotation === 90) return { x: point.y * width, y: point.x * height };
    if (normalizedRotation === 180) return { x: (1 - point.x) * width, y: point.y * height };
    if (normalizedRotation === 270) return { x: (1 - point.y) * width, y: (1 - point.x) * height };
    return { x: point.x * width, y: (1 - point.y) * height };
  };

  for (const annotation of annotations) {
    const page = pages[annotation.page - 1];
    if (!page) continue;
    const { width, height } = page.getSize();
    const color = hexToRgb(annotation.color);

    if (annotation.type === "ink") {
      for (let index = 1; index < annotation.points.length; index += 1) {
        const previous = annotation.points[index - 1];
        const current = annotation.points[index];
        const start = toPdfPoint(previous, width, height, annotation.rotation);
        const end = toPdfPoint(current, width, height, annotation.rotation);
        page.drawLine({
          start,
          end,
          thickness: Math.max(0.7, annotation.width * width),
          color,
          opacity: annotation.opacity,
        });
      }
    }

    if (annotation.type === "highlight") {
      const start = toPdfPoint(annotation.start, width, height, annotation.rotation);
      const end = toPdfPoint(annotation.end, width, height, annotation.rotation);
      const left = Math.min(start.x, end.x);
      const bottom = Math.min(start.y, end.y);
      const rectWidth = Math.abs(end.x - start.x);
      const rectHeight = Math.abs(end.y - start.y);
      page.drawRectangle({
        x: left,
        y: bottom,
        width: rectWidth,
        height: rectHeight,
        color,
        opacity: annotation.opacity,
      });
    }

    if (annotation.type === "text" && annotation.text.trim()) {
      const size = Math.max(6, annotation.size * (width / 800));
      const point = toPdfPoint(annotation.point, width, height, annotation.rotation);
      const safeText = annotation.text.replace(/[^\x20-\x7E\n\r]/g, "?");
      page.drawText(safeText, {
        x: point.x,
        y: point.y - size,
        size,
        font,
        color,
        opacity: annotation.opacity,
        maxWidth: width * (1 - annotation.point.x) - 12,
        lineHeight: size * 1.25,
      });
    }
  }

  return document.save();
}

export function findInPages(pageTexts: string[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return [];
  const results: SearchResult[] = [];

  pageTexts.forEach((text, pageIndex) => {
    const source = text.toLocaleLowerCase();
    let cursor = 0;
    while (cursor < source.length && results.length < 500) {
      const found = source.indexOf(query, cursor);
      if (found === -1) break;
      const before = Math.max(0, found - 34);
      const after = Math.min(text.length, found + query.length + 46);
      const prefix = before > 0 ? "…" : "";
      const suffix = after < text.length ? "…" : "";
      results.push({
        page: pageIndex + 1,
        index: results.length,
        snippet: `${prefix}${text.slice(before, after).replace(/\s+/g, " ")}${suffix}`,
      });
      cursor = found + Math.max(query.length, 1);
    }
  });

  return results;
}
