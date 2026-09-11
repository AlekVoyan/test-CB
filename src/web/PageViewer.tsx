// The cited page itself: the real PDF page rendered by pdf.js, the passage in focus, cited lines framed, with zoom.
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Rect } from "../core/types";
import { pdfjs } from "./pdfjs";

type PdfDocument = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;
type RenderTask = ReturnType<PdfPage["render"]>;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Layout {
  width: number;
  height: number;
  frames: Box[];
  spot: Box | null;
}

/** Zoom steps, relative to the page fitted to the panel's width. */
const ZOOMS = [1, 1.25, 1.5, 2, 2.5, 3];
const MIN_ZOOM = ZOOMS[0]!;
const MAX_ZOOM = ZOOMS[ZOOMS.length - 1]!;
/** iOS Safari refuses canvases above ~16.7 million pixels; the page stays under it at any zoom. */
const MAX_CANVAS_PIXELS = 16_000_000;
/** A pinch or ctrl-scroll counts as finished after this pause; then the page is rendered sharp. */
const GESTURE_REST_MS = 160;
const CLOSE_MS = 280;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The smallest box around all of them, with some air. */
function around(boxes: Box[], pad: number): Box | null {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((b) => b.left)) - pad;
  const top = Math.min(...boxes.map((b) => b.top)) - pad;
  const right = Math.max(...boxes.map((b) => b.left + b.width)) + pad;
  const bottom = Math.max(...boxes.map((b) => b.top + b.height)) + pad;
  return { left, top, width: right - left, height: bottom - top };
}

export function PageViewer(props: {
  bytes: Uint8Array;
  filename: string;
  page: number;
  /** Boxes of the cited lines (framed) and of the whole paragraph (kept in focus), in PDF page space. */
  cited: Rect[];
  passage: Rect[];
  onClose: () => void;
  /** Where focus goes back to when the panel closes. */
  opener: HTMLElement | null;
}) {
  const [closing, setClosing] = useState(false);
  const [pdfPage, setPdfPage] = useState<PdfPage | null>(null);
  /** The scale at which the page fills the panel's width. */
  const [fit, setFit] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [failed, setFailed] = useState(false);

  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const taskRef = useRef<RenderTask | null>(null);
  /** A finished render waiting to be swapped in together with its frames. */
  const bufferRef = useRef<{ canvas: HTMLCanvasElement; width: number; height: number } | null>(null);
  const centeredRef = useRef(false);
  /** Keeps the view steady across a zoom: a point of the page (as a fraction) and where it sits in the panel. */
  const anchorRef = useRef<{ fx: number; fy: number; ax: number; ay: number } | null>(null);
  /** A pinch or ctrl-scroll in progress: the zoom it has reached, the fixed point, and the rest timer. */
  const gestureRef = useRef<{ zoom: number; at: { x: number; y: number }; timer: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => {
      props.onClose();
      props.opener?.focus();
    }, CLOSE_MS);
  }

  /** Zooms to a level, keeping the page point at `at` (viewport px; the panel's middle by default) where it is. */
  function zoomTo(next: number, at?: { x: number; y: number }) {
    const target = clampZoom(next);
    const body = bodyRef.current;
    const pageEl = pageRef.current;
    const current = layoutRef.current;
    if (target === zoomRef.current) {
      if (pageEl) pageEl.style.transform = "";
      return;
    }
    if (body && pageEl && current) {
      const b = body.getBoundingClientRect();
      const ax = at ? at.x - b.left : body.clientWidth / 2;
      const ay = at ? at.y - b.top : body.clientHeight / 2;
      anchorRef.current = {
        fx: (body.scrollLeft + ax - pageEl.offsetLeft) / current.width,
        fy: (body.scrollTop + ay - pageEl.offsetTop) / current.height,
        ax,
        ay,
      };
    }
    setZoom(target);
  }

  function stepZoom(dir: 1 | -1) {
    const z = zoomRef.current;
    zoomTo(dir > 0 ? (ZOOMS.find((s) => s > z + 0.01) ?? MAX_ZOOM) : ([...ZOOMS].reverse().find((s) => s < z - 0.01) ?? MIN_ZOOM));
  }

  /** Pinch and ctrl-scroll: scale the rendered page at once around the gesture's point, render it sharp at rest. */
  function previewZoom(next: number, at: { x: number; y: number }) {
    const pageEl = pageRef.current;
    if (!pageEl || !layoutRef.current) return;
    let gesture = gestureRef.current;
    if (!gesture) {
      const p = pageEl.getBoundingClientRect();
      pageEl.style.transformOrigin = `${at.x - p.left}px ${at.y - p.top}px`;
      gesture = { zoom: zoomRef.current, at, timer: 0 };
      gestureRef.current = gesture;
    }
    gesture.zoom = clampZoom(next);
    pageEl.style.transform = `scale(${gesture.zoom / zoomRef.current})`;
    window.clearTimeout(gesture.timer);
    gesture.timer = window.setTimeout(() => {
      const done = gestureRef.current;
      gestureRef.current = null;
      if (done) zoomTo(done.zoom, done.at);
    }, GESTURE_REST_MS);
  }

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      // Zoom keys without modifiers; Ctrl/⌘ with + and − stay the browser's own zoom.
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "+" || e.key === "=") return (e.preventDefault(), stepZoom(1));
        if (e.key === "-" || e.key === "_") return (e.preventDefault(), stepZoom(-1));
        if (e.key === "0") return (e.preventDefault(), zoomTo(1));
      }
      // Keep focus inside the dialog.
      if (e.key === "Tab" && panelRef.current) {
        const stops = [...panelRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='0']")];
        if (!stops.length) return;
        const i = stops.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]!.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Ctrl/⌘ + scroll, which is also how a trackpad reports a pinch; a plain scroll moves the page.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const base = gestureRef.current?.zoom ?? zoomRef.current;
      previewZoom(base * Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY });
    };
    body.addEventListener("wheel", onWheel, { passive: false });
    return () => body.removeEventListener("wheel", onWheel);
  }, []);

  // Two-finger pinch on touch screens; one finger still scrolls (touch-action: pan-x pan-y).
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const touches = new Map<number, { x: number; y: number }>();
    let start: { distance: number; zoom: number } | null = null;
    const pair = () => [...touches.values()] as [{ x: number; y: number }, { x: number; y: number }];
    const distance = () => {
      const [a, b] = pair();
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) start = { distance: distance(), zoom: zoomRef.current };
    };
    const move = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || !start || !start.distance) return;
      const [a, b] = pair();
      previewZoom(start.zoom * (distance() / start.distance), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) start = null;
    };
    body.addEventListener("pointerdown", down);
    body.addEventListener("pointermove", move);
    body.addEventListener("pointerup", up);
    body.addEventListener("pointercancel", up);
    return () => {
      body.removeEventListener("pointerdown", down);
      body.removeEventListener("pointermove", move);
      body.removeEventListener("pointerup", up);
      body.removeEventListener("pointercancel", up);
    };
  }, []);

  // Open the document once; the page proxy is reused for every zoom level.
  useEffect(() => {
    let cancelled = false;
    const loading = pdfjs.getDocument({ data: props.bytes.slice() });
    loading.promise
      .then((doc) => doc.getPage(props.page))
      .then((p) => !cancelled && setPdfPage(p))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      taskRef.current?.cancel();
      void loading.destroy();
    };
  }, [props.bytes, props.page]);

  // The fit-to-width scale, again whenever the panel changes width.
  useEffect(() => {
    const body = bodyRef.current;
    if (!pdfPage || !body) return;
    const measure = () => setFit(Math.max(0.1, (body.clientWidth - 32) / pdfPage.getViewport({ scale: 1 }).width));
    measure();
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    });
    observer.observe(body);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pdfPage]);

  // Render at fit × zoom into an offscreen canvas, then swap it in, so a new zoom level never flashes blank.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdfPage || !canvas || fit <= 0) return;
    let cancelled = false;
    (async () => {
      const previous = taskRef.current;
      if (previous) {
        previous.cancel();
        await previous.promise.catch(() => undefined);
      }
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale: fit * zoom });
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)));
      const buffer = document.createElement("canvas");
      buffer.width = Math.floor(viewport.width * dpr);
      buffer.height = Math.floor(viewport.height * dpr);
      const task = pdfPage.render({ canvas: buffer, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
      taskRef.current = task;
      await task.promise;
      if (cancelled) return;
      // Swapped in by the layout effect with the new frames, so pixels and frames change in the same paint.
      bufferRef.current = { canvas: buffer, width: viewport.width, height: viewport.height };

      const toCss = (r: Rect): Box => {
        const [x1, y1] = viewport.convertToViewportPoint(r.x, r.y) as number[];
        const [x2, y2] = viewport.convertToViewportPoint(r.x + r.width, r.y + r.height) as number[];
        return { left: Math.min(x1!, x2!), top: Math.min(y1!, y2!), width: Math.abs(x2! - x1!), height: Math.abs(y2! - y1!) };
      };
      setLayout({
        width: viewport.width,
        height: viewport.height,
        frames: props.cited.map((r) => around([toCss(r)], 3)!),
        spot: around(props.passage.map(toCss), 10),
      });
    })().catch((error: { name?: string }) => {
      if (!cancelled && error?.name !== "RenderingCancelledException") setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [pdfPage, fit, zoom, props.cited, props.passage]);

  // After each render, before the paint: swap in the new pixels, drop the gesture preview and keep the anchored point
  // still; the first time, bring the passage to the middle.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const pageEl = pageRef.current;
    if (!layout || !body || !pageEl) return;
    const canvas = canvasRef.current;
    const rendered = bufferRef.current;
    if (canvas && rendered) {
      bufferRef.current = null;
      canvas.width = rendered.canvas.width;
      canvas.height = rendered.canvas.height;
      canvas.style.width = `${rendered.width}px`;
      canvas.style.height = `${rendered.height}px`;
      canvas.getContext("2d")?.drawImage(rendered.canvas, 0, 0);
    }
    if (!gestureRef.current) pageEl.style.transform = "";
    const anchor = anchorRef.current;
    if (anchor) {
      anchorRef.current = null;
      body.scrollLeft = pageEl.offsetLeft + anchor.fx * layout.width - anchor.ax;
      body.scrollTop = pageEl.offsetTop + anchor.fy * layout.height - anchor.ay;
    } else if (!centeredRef.current && layout.spot) {
      centeredRef.current = true;
      const top = pageEl.offsetTop + layout.spot.top - Math.max(0, (body.clientHeight - layout.spot.height) / 2);
      body.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [layout]);

  const state = closing ? "closed" : "open";
  const px = (b: Box): CSSProperties => ({ left: b.left, top: b.top, width: b.width, height: b.height });
  return (
    <>
      <div className="pv-backdrop" data-state={state} onClick={close} aria-hidden />
      <aside ref={panelRef} className="pv" data-state={state} role="dialog" aria-modal="true" aria-labelledby="pv-title">
        <header className="pv-head">
          <h2 id="pv-title">
            {props.filename} · Page {props.page}
          </h2>
          <div className="pv-tools">
            <div className="pv-zoom" role="group" aria-label="Zoom">
              <button type="button" className="icon-btn" onClick={() => stepZoom(-1)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out (−)">
                <MagnifyingGlassMinusIcon weight="bold" aria-hidden />
              </button>
              <button type="button" className="pv-zoom-level" onClick={() => zoomTo(1)} aria-label={`Zoom ${Math.round(zoom * 100)}%, fit to width`} title="Fit to width (0)">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className="icon-btn" onClick={() => stepZoom(1)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in (+)">
                <MagnifyingGlassPlusIcon weight="bold" aria-hidden />
              </button>
            </div>
            <button ref={closeRef} type="button" className="icon-btn" onClick={close} aria-label="Close the page">
              <XIcon weight="bold" aria-hidden />
            </button>
          </div>
        </header>
        <div className="pv-body" ref={bodyRef} tabIndex={0} aria-label={`Page ${props.page}, the cited passage in focus`}>
          <div ref={pageRef} className="pv-page" style={layout ? { width: layout.width, height: layout.height } : undefined}>
            <canvas ref={canvasRef} />
            {layout?.spot && <div className="pv-spot" style={px(layout.spot)} />}
            {layout?.frames.map((f, i) => <div key={i} className="pv-frame" style={px(f)} />)}
          </div>
          {!layout && !failed && <p className="pv-note">Rendering the page…</p>}
          {failed && <p className="pv-note">This page could not be rendered. The quotes on the sheet are still exact.</p>}
        </div>
        <p className="pv-foot">
          {props.cited.length} framed {props.cited.length === 1 ? "line" : "lines"} · zoom with + and −, a pinch, or Ctrl/⌘ and scroll
        </p>
      </aside>
    </>
  );
}
