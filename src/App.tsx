import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Icons } from "./icons";
import { applyAnnotations, findInPages } from "./pdf";
import PdfPageView from "./PdfPageView";
import { choosePdf, savePdf, type OpenedPdf } from "./storage";
import type { Annotation, PageLayout, Tool, ToolSettings } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const COLORS = ["#df5a46", "#e5ae38", "#4d9b78", "#3d78b9", "#7a62aa", "#23231f"];
const TOOL_LABELS: Record<Tool, string> = {
  select: "Select",
  pen: "Pen",
  highlight: "Highlight",
  text: "Text",
  eraser: "Eraser",
};

function suggestedOutputName(name: string) {
  return name.replace(/\.pdf$/i, "") + " - annotated.pdf";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ToolButton({ tool, active, disabled, onClick }: { tool: Tool; active: boolean; disabled: boolean; onClick: () => void }) {
  const Icon = tool === "select" ? Icons.cursor : tool === "pen" ? Icons.pen : tool === "highlight" ? Icons.highlight : tool === "text" ? Icons.text : Icons.eraser;
  return (
    <button className={`tool-button ${active ? "active" : ""}`} onClick={onClick} disabled={disabled} title={TOOL_LABELS[tool]} aria-label={TOOL_LABELS[tool]}>
      <Icon />
      <span>{TOOL_LABELS[tool]}</span>
    </button>
  );
}

export default function App() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [file, setFile] = useState<OpenedPdf | null>(null);
  const [pageLayouts, setPageLayouts] = useState<PageLayout[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [tool, setTool] = useState<Tool>("select");
  const [settings, setSettings] = useState<ToolSettings>({ color: "#df5a46", width: 3, opacity: 0.72, textSize: 18 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);

  const searchResults = useMemo(() => findInPages(pageTexts, searchQuery), [pageTexts, searchQuery]);
  const pageSearchCount = useMemo(() => searchResults.filter((item) => item.page === pageNumber).length, [searchResults, pageNumber]);

  const commit = useCallback((next: Annotation[]) => {
    setAnnotations((current) => {
      setPast((history) => [...history.slice(-49), current]);
      setFuture([]);
      return next;
    });
    setDirty(true);
  }, []);

  const addAnnotation = useCallback((annotation: Annotation) => commit([...annotations, annotation]), [annotations, commit]);
  const removeAnnotation = useCallback((id: string) => commit(annotations.filter((annotation) => annotation.id !== id)), [annotations, commit]);
  const handlePageError = useCallback((message: string) => setError(message), []);

  const undo = useCallback(() => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setFuture((items) => [annotations, ...items]);
    setAnnotations(previous);
    setPast((items) => items.slice(0, -1));
    setDirty(true);
  }, [annotations, past]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setPast((items) => [...items, annotations]);
    setAnnotations(next);
    setFuture((items) => items.slice(1));
    setDirty(true);
  }, [annotations, future]);

  const loadPdf = useCallback(async (opened: OpenedPdf) => {
    setLoading(true);
    setError(null);
    setStatus("Opening document…");
    setPageLayouts([]);
    setPageTexts([]);
    try {
      const task = pdfjs.getDocument({ data: opened.bytes.slice() });
      const nextPdf = await task.promise;
      setPdf((current) => {
        void current?.destroy();
        return nextPdf;
      });
      setFile(opened);
      setPageNumber(1);
      setZoom(100);
      setAnnotations([]);
      setPast([]);
      setFuture([]);
      setSearchQuery("");
      setDirty(false);
      setStatus(`${nextPdf.numPages} page${nextPdf.numPages === 1 ? "" : "s"}`);

      setIndexing(true);
      const layouts: PageLayout[] = [];
      const texts = new Array<string>(nextPdf.numPages).fill("");
      for (let index = 1; index <= nextPdf.numPages; index += 1) {
        const page = await nextPdf.getPage(index);
        const viewport = page.getViewport({ scale: 1 });
        layouts.push({ width: viewport.width, height: viewport.height, rotation: viewport.rotation });
        const content = await page.getTextContent();
        texts[index - 1] = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ");
        if (index === 1 || index % 5 === 0) {
          setPageLayouts([...layouts]);
          setPageTexts([...texts]);
        }
      }
      setPageLayouts(layouts);
      setPageTexts(texts);
      setIndexing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This PDF could not be opened.");
      setStatus("Could not open file");
    } finally {
      setLoading(false);
      setIndexing(false);
    }
  }, []);

  const openDocument = useCallback(async () => {
    try {
      const opened = await choosePdf();
      if (opened) await loadPdf(opened);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The file picker could not be opened.");
    }
  }, [loadPdf]);

  const saveDocument = useCallback(async () => {
    if (!file || !pdf) return;
    setSaving(true);
    setError(null);
    setStatus("Preparing PDF…");
    try {
      const output = annotations.length ? await applyAnnotations(file.bytes.slice(), annotations) : file.bytes;
      const saved = await savePdf(output, suggestedOutputName(file.name));
      if (saved) {
        setDirty(false);
        setStatus(`Saved ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`);
      } else {
        setStatus("Save cancelled");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The annotated PDF could not be saved.");
      setStatus("Save failed");
    } finally {
      setSaving(false);
    }
  }, [annotations, file, pdf]);

  const goToPage = useCallback((requestedPage: number, behavior: ScrollBehavior = "smooth") => {
    if (!pdf) return;
    const targetPage = clamp(requestedPage, 1, pdf.numPages);
    setPageNumber(targetPage);
    requestAnimationFrame(() => {
      const target = pageScrollRef.current?.querySelector<HTMLElement>(`[data-page-number="${targetPage}"]`);
      target?.scrollIntoView({ behavior, block: "start" });
    });
  }, [pdf]);

  const trackCurrentPage = useCallback(() => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      const scroller = pageScrollRef.current;
      if (!scroller) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const readingLine = scrollerRect.top + Math.min(scrollerRect.height * 0.32, 250);
      let closestPage = pageNumber;
      let closestDistance = Number.POSITIVE_INFINITY;
      scroller.querySelectorAll<HTMLElement>("[data-page-number]").forEach((element) => {
        const rect = element.getBoundingClientRect();
        const distance = readingLine < rect.top ? rect.top - readingLine : readingLine > rect.bottom ? readingLine - rect.bottom : 0;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = Number(element.dataset.pageNumber);
        }
      });
      setPageNumber((current) => current === closestPage ? current : closestPage);
      scrollFrameRef.current = null;
    });
  }, [pageNumber]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const jumpSearch = (direction: 1 | -1) => {
    if (!searchResults.length) return;
    const next = (activeSearchIndex + direction + searchResults.length) % searchResults.length;
    setActiveSearchIndex(next);
    goToPage(searchResults[next].page);
  };

  const closeDocument = () => {
    void pdf?.destroy();
    setPdf(null);
    setFile(null);
    setPageLayouts([]);
    setPageTexts([]);
    setAnnotations([]);
    setPast([]);
    setFuture([]);
    setSearchOpen(false);
    setDirty(false);
    setStatus("Ready");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openDocument();
      }
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDocument();
      }
      if (command && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
      if (event.key === "Escape") {
        setOptionsOpen(false);
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDocument, redo, saveDocument, undo]);

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (!dropped) return;
    if (dropped.type !== "application/pdf" && !dropped.name.toLowerCase().endsWith(".pdf")) {
      setError("PaperLite can open PDF files only.");
      return;
    }
    await loadPdf({ name: dropped.name, bytes: new Uint8Array(await dropped.arrayBuffer()) });
  };

  return (
    <div className="app-shell" onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={handleDrop}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Icons.file /></span><span>PaperLite</span></div>
        <div className="document-title" title={file?.name}>{file ? <><span className="file-dot" />{file.name}{dirty && <span className="dirty-dot" title="Unsaved annotations" />}</> : "Private PDF workspace"}</div>
        <div className="top-actions">
          <button className="action-button" onClick={() => void openDocument()}><Icons.open /><span>Open</span></button>
          <button className="action-button primary" onClick={() => void saveDocument()} disabled={!pdf || saving}><Icons.save /><span>{saving ? "Saving…" : "Save a copy"}</span></button>
          <div className="menu-wrap">
            <button className={`icon-button ${moreOpen ? "active" : ""}`} onClick={() => setMoreOpen((value) => !value)} aria-label="More options" title="More options"><Icons.more /></button>
            {moreOpen && (
              <div className="popup-menu top-menu">
                <button onClick={() => { setZoom(100); setMoreOpen(false); }} disabled={!pdf}><Icons.fit />Reset zoom</button>
                <div className="menu-rule" />
                <button onClick={() => { if (annotations.length) commit([]); setMoreOpen(false); }} disabled={!annotations.length}><Icons.eraser />Clear annotations</button>
                <button onClick={() => { closeDocument(); setMoreOpen(false); }} disabled={!pdf}><Icons.close />Close document</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className="tool-rail" aria-label="Annotation tools">
        <div className="rail-tools">
          {(["select", "pen", "highlight", "text", "eraser"] as Tool[]).map((item) => <ToolButton key={item} tool={item} active={tool === item} disabled={!pdf} onClick={() => setTool(item)} />)}
        </div>
        <div className="history-tools">
          <button className="rail-icon" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)" aria-label="Undo"><Icons.undo /></button>
          <button className="rail-icon" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Icons.redo /></button>
        </div>
      </aside>

      <main className="workspace">
        {!pdf ? (
          <section className="welcome">
            <div className="welcome-art" aria-hidden="true">
              <div className="paper-sheet back" />
              <div className="paper-sheet front"><span /><span /><span /><i /></div>
              <div className="pencil"><b /><em /></div>
            </div>
            <p className="eyebrow">Offline · private · lightweight</p>
            <h1>Your PDFs, minus the clutter.</h1>
            <p className="welcome-copy">Read, find, highlight, draw, and add notes. Everything stays on your computer.</p>
            <button className="open-hero" onClick={() => void openDocument()} disabled={loading}><Icons.open />{loading ? "Opening…" : "Open a PDF"}</button>
            <p className="drop-hint">or drop a PDF anywhere · Ctrl + O</p>
            <div className="feature-row">
              <span><Icons.search />Fast text search</span>
              <span><Icons.pen />Simple annotation</span>
              <span><Icons.save />PDF export</span>
            </div>
          </section>
        ) : (
          <div className={`document-area tool-${tool}`}>
            <div ref={pageScrollRef} className="page-scroll" onScroll={trackCurrentPage}>
              <div className="page-stream">
                {!pageLayouts.length && <div className="document-loading"><span /><p>Preparing pages…</p></div>}
                {pageLayouts.map((layout, index) => (
                  <PdfPageView
                    key={index + 1}
                    pdf={pdf}
                    pageNumber={index + 1}
                    layout={layout}
                    zoom={zoom}
                    tool={tool}
                    settings={settings}
                    annotations={annotations.filter((annotation) => annotation.page === index + 1)}
                    searchQuery={searchQuery}
                    onAddAnnotation={addAnnotation}
                    onRemoveAnnotation={removeAnnotation}
                    onError={handlePageError}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {pdf && (
          <div className="bottom-dock">
            <div className="page-nav">
              <button onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} aria-label="Previous page"><Icons.chevronLeft /></button>
              <label><input value={pageNumber} onChange={(event) => goToPage(Number(event.target.value) || 1)} aria-label="Current page" /><span>/ {pdf.numPages}</span></label>
              <button onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= pdf.numPages} aria-label="Next page"><Icons.chevronRight /></button>
            </div>
            <div className="dock-rule" />
            <div className="zoom-control">
              <button onClick={() => setZoom((value) => clamp(value - 10, 35, 220))} aria-label="Zoom out"><Icons.minus /></button>
              <input type="range" min="35" max="220" step="5" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom" />
              <button onClick={() => setZoom((value) => clamp(value + 10, 35, 220))} aria-label="Zoom in"><Icons.plus /></button>
              <output>{zoom}%</output>
            </div>
            <div className="dock-rule" />
            <div className="menu-wrap">
              <button className={`options-button ${optionsOpen ? "active" : ""}`} onClick={() => setOptionsOpen((value) => !value)}><span className="color-chip" style={{ background: settings.color }} /><span>{TOOL_LABELS[tool]} options</span><Icons.chevronDown /></button>
              {optionsOpen && (
                <div className="tool-options">
                  <div className="options-heading"><span>{TOOL_LABELS[tool]}</span><button onClick={() => setOptionsOpen(false)} aria-label="Close options"><Icons.close /></button></div>
                  <label className="setting-label">Color</label>
                  <div className="swatches">
                    {COLORS.map((color) => <button key={color} className={settings.color === color ? "selected" : ""} style={{ background: color }} onClick={() => setSettings({ ...settings, color })} aria-label={`Use ${color}`}>{settings.color === color && <Icons.check />}</button>)}
                  </div>
                  {tool === "pen" && <label className="slider-setting"><span>Stroke<output>{settings.width}px</output></span><input type="range" min="1" max="14" value={settings.width} onChange={(event) => setSettings({ ...settings, width: Number(event.target.value) })} /></label>}
                  {tool === "text" && <label className="slider-setting"><span>Text size<output>{settings.textSize}px</output></span><input type="range" min="10" max="40" value={settings.textSize} onChange={(event) => setSettings({ ...settings, textSize: Number(event.target.value) })} /></label>}
                  {tool !== "select" && tool !== "eraser" && <label className="slider-setting"><span>Opacity<output>{Math.round(settings.opacity * 100)}%</output></span><input type="range" min="20" max="100" value={settings.opacity * 100} onChange={(event) => setSettings({ ...settings, opacity: Number(event.target.value) / 100 })} /></label>}
                  {(tool === "select" || tool === "eraser") && <p className="options-note">{tool === "select" ? "Drag over text to select and copy it." : "Click an annotation to remove it."}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <button className={`find-toggle ${searchOpen ? "active" : ""}`} onClick={() => setSearchOpen((value) => !value)} disabled={!pdf} title="Find (Ctrl+F)" aria-label="Find in document"><Icons.search /></button>

      {searchOpen && pdf && (
        <aside className="search-panel">
          <div className="search-head"><h2>Find in document</h2><button onClick={() => setSearchOpen(false)} aria-label="Close search"><Icons.close /></button></div>
          <div className="search-input-wrap"><Icons.search /><input autoFocus value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setActiveSearchIndex(0); }} onKeyDown={(event) => { if (event.key === "Enter") jumpSearch(event.shiftKey ? -1 : 1); }} placeholder="Search words or phrases" /><button onClick={() => setSearchQuery("")} className={searchQuery ? "visible" : ""} aria-label="Clear search"><Icons.close /></button></div>
          <div className="search-meta">
            <span>{indexing ? "Reading pages…" : searchQuery ? `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}` : "Type to search every page"}</span>
            {!!searchResults.length && <div><button onClick={() => jumpSearch(-1)} aria-label="Previous result"><Icons.chevronLeft /></button><button onClick={() => jumpSearch(1)} aria-label="Next result"><Icons.chevronRight /></button></div>}
          </div>
          <div className="search-results">
            {searchResults.map((result, index) => (
              <button key={`${result.page}-${result.index}`} className={index === activeSearchIndex ? "current" : ""} onClick={() => { setActiveSearchIndex(index); goToPage(result.page); }}>
                <span>Page {result.page}</span>
                <p>{result.snippet}</p>
              </button>
            ))}
            {!!searchQuery && !indexing && !searchResults.length && <div className="empty-results"><Icons.search /><p>No matches found</p><span>Try another word or phrase.</span></div>}
          </div>
        </aside>
      )}

      <footer className="statusbar">
        <span>{status}</span>
        {pdf && <span>Page {pageNumber} of {pdf.numPages} · {annotations.length} annotation{annotations.length === 1 ? "" : "s"}{pageSearchCount > 0 ? ` · ${pageSearchCount} match${pageSearchCount === 1 ? "" : "es"} on this page` : ""}</span>}
      </footer>

      {dragging && <div className="drop-overlay"><div><Icons.file /><strong>Drop your PDF here</strong><span>It stays on this computer</span></div></div>}
      {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss"><Icons.close /></button></div>}
    </div>
  );
}
