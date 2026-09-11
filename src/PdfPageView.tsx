import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Annotation, HighlightAnnotation, InkAnnotation, PageLayout, Point, Tool, ToolSettings } from "./types";

interface TextLayerItem {
  text: string;
  left: number;
  top: number;
  fontSize: number;
  width: number;
  height: number;
  angle: number;
}

interface TextComposer {
  point: Point;
  value: string;
}

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  layout: PageLayout;
  zoom: number;
  tool: Tool;
  settings: ToolSettings;
  annotations: Annotation[];
  searchQuery: string;
  onAddAnnotation: (annotation: Annotation) => void;
  onRemoveAnnotation: (id: string) => void;
  onError: (message: string) => void;
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function PdfPageView({ pdf, pageNumber, layout, zoom, tool, settings, annotations, searchQuery, onAddAnnotation, onRemoveAnnotation, onError }: Props) {
  const [nearby, setNearby] = useState(pageNumber <= 2);
  const [textLayer, setTextLayer] = useState<TextLayerItem[]>([]);
  const [draft, setDraft] = useState<InkAnnotation | HighlightAnnotation | null>(null);
  const [textComposer, setTextComposer] = useState<TextComposer | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const renderId = useRef(0);
  const scale = 1.2 * (zoom / 100);
  const width = layout.width * scale;
  const height = layout.height * scale;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNearby(entry.isIntersecting),
      { root: null, rootMargin: "900px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!nearby) {
      canvasRef.current.width = 1;
      canvasRef.current.height = 1;
      setTextLayer([]);
      return;
    }

    const currentRender = ++renderId.current;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;

    const render = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        await renderTask.promise;
        if (cancelled || currentRender !== renderId.current) return;

        const content = await page.getTextContent();
        const items: TextLayerItem[] = [];
        for (const rawItem of content.items) {
          if (!("str" in rawItem) || !rawItem.str) continue;
          const item = rawItem as typeof rawItem & { transform: number[]; width: number; height: number };
          const transform = pdfjs.Util.transform(viewport.transform, item.transform);
          const fontSize = Math.hypot(transform[2], transform[3]);
          items.push({
            text: item.str,
            left: transform[4],
            top: transform[5] - fontSize,
            fontSize,
            width: Math.max(item.width * scale, 1),
            height: Math.max(fontSize, item.height * scale, 1),
            angle: Math.atan2(transform[1], transform[0]),
          });
        }
        setTextLayer(items);
      } catch (reason) {
        if (!cancelled && (reason as { name?: string }).name !== "RenderingCancelledException") {
          onError(reason instanceof Error ? reason.message : `Page ${pageNumber} could not be rendered.`);
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [nearby, onError, pageNumber, pdf, scale]);

  useEffect(() => {
    textInputRef.current?.focus();
  }, [textComposer]);

  const pointFromEvent = (event: React.PointerEvent): Point => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
  };

  const removeAtPoint = (point: Point) => {
    const hit = [...annotations].reverse().find((annotation) => {
      if (annotation.type === "ink") return annotation.points.some((candidate) => distance(candidate, point) < 0.018);
      if (annotation.type === "highlight") {
        const left = Math.min(annotation.start.x, annotation.end.x);
        const right = Math.max(annotation.start.x, annotation.end.x);
        const top = Math.min(annotation.start.y, annotation.end.y);
        const bottom = Math.max(annotation.start.y, annotation.end.y);
        return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
      }
      return distance(annotation.point, point) < 0.045;
    });
    if (hit) onRemoveAnnotation(hit.id);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "select") return;
    const point = pointFromEvent(event);
    if (tool === "eraser") return removeAtPoint(point);
    if (tool === "text") {
      setTextComposer({ point, value: "" });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "pen") {
      setDraft({ id: uid(), page: pageNumber, rotation: layout.rotation, type: "ink", points: [point], color: settings.color, opacity: settings.opacity, width: settings.width / Math.max(width, 1) });
    } else {
      setDraft({ id: uid(), page: pageNumber, rotation: layout.rotation, type: "highlight", start: point, end: point, color: settings.color, opacity: Math.min(settings.opacity, 0.48) });
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    const point = pointFromEvent(event);
    if (draft.type === "ink") {
      const previous = draft.points[draft.points.length - 1];
      if (distance(previous, point) > 0.002) setDraft({ ...draft, points: [...draft.points, point] });
    } else {
      setDraft({ ...draft, end: point });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const valid = draft.type === "ink" ? draft.points.length > 1 : distance(draft.start, draft.end) > 0.005;
    if (valid) onAddAnnotation(draft);
    setDraft(null);
  };

  const finishText = () => {
    if (textComposer?.value.trim()) {
      onAddAnnotation({
        id: uid(), page: pageNumber, rotation: layout.rotation, type: "text", point: textComposer.point,
        text: textComposer.value.trim(), color: settings.color, opacity: settings.opacity, size: settings.textSize,
      });
    }
    setTextComposer(null);
  };

  const renderAnnotation = (annotation: Annotation, temporary = false) => {
    if (annotation.type === "ink") {
      return <polyline key={annotation.id} points={annotation.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={annotation.color} strokeWidth={annotation.width} strokeOpacity={annotation.opacity} strokeLinecap="round" strokeLinejoin="round" className={temporary ? "draft-mark" : ""} />;
    }
    if (annotation.type === "highlight") {
      const x = Math.min(annotation.start.x, annotation.end.x);
      const y = Math.min(annotation.start.y, annotation.end.y);
      return <rect key={annotation.id} x={x} y={y} width={Math.abs(annotation.end.x - annotation.start.x)} height={Math.abs(annotation.end.y - annotation.start.y)} fill={annotation.color} fillOpacity={annotation.opacity} rx="0.003" className={temporary ? "draft-mark" : ""} />;
    }
    return null;
  };

  return (
    <div ref={wrapperRef} className="page-frame" data-page-number={pageNumber} aria-label={`Page ${pageNumber}`}>
      <span className="page-number-badge">{pageNumber}</span>
      <div
        ref={surfaceRef}
        className="page-surface"
        style={{ width, height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDraft(null)}
      >
        <canvas ref={canvasRef} className="pdf-canvas" />
        {!nearby && <div className="page-placeholder"><span>Page {pageNumber}</span></div>}
        <div className="text-layer" aria-hidden="true">
          {textLayer.map((item, index) => {
            const match = !!searchQuery.trim() && item.text.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase());
            return <span key={`${index}-${item.left}`} className={match ? "text-match" : ""} style={{ left: item.left, top: item.top, fontSize: item.fontSize, width: item.width, height: item.height, transform: `rotate(${item.angle}rad)` }}>{item.text}</span>;
          })}
        </div>
        <svg className="annotation-layer" viewBox="0 0 1 1" preserveAspectRatio="none" aria-label={`Annotations on page ${pageNumber}`}>
          {annotations.filter((item) => item.type !== "text").map((item) => renderAnnotation(item))}
          {draft && renderAnnotation(draft, true)}
        </svg>
        <div className="text-annotations">
          {annotations.filter((item) => item.type === "text").map((item) => item.type === "text" && (
            <span key={item.id} className="placed-text" style={{ left: `${item.point.x * 100}%`, top: `${item.point.y * 100}%`, color: item.color, opacity: item.opacity, fontSize: `${item.size * zoom / 100}px` }}>{item.text}</span>
          ))}
          {textComposer && (
            <div className="text-composer" style={{ left: `${textComposer.point.x * 100}%`, top: `${textComposer.point.y * 100}%` }} onPointerDown={(event) => event.stopPropagation()}>
              <input ref={textInputRef} value={textComposer.value} placeholder="Type a note…" onChange={(event) => setTextComposer({ ...textComposer, value: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") setTextComposer(null); }} onBlur={finishText} style={{ color: settings.color, fontSize: settings.textSize }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
