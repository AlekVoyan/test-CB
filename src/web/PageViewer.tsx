// The cited page itself: the real PDF page rendered by pdf.js, the passage in focus, cited lines framed.
import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Rect } from "../core/types";
import { pdfjs } from "./pdfjs";

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

const CLOSE_MS = 280;
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
  const [layout, setLayout] = useState<Layout | null>(null);
  const [failed, setFailed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);

  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => {
      props.onClose();
      props.opener?.focus();
    }, CLOSE_MS);
  }

  // The panel slides in by itself (CSS @starting-style); it only needs focus.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      // Keep focus inside the dialog: the close button and the scrollable page are its only stops.
      if (e.key === "Tab" && bodyRef.current && closeRef.current) {
        const next = document.activeElement === closeRef.current ? bodyRef.current : closeRef.current;
        e.preventDefault();
        next.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ data: props.bytes.slice() });
    (async () => {
      const doc = await task.promise;
      const page = await doc.getPage(props.page);
      const fit = (bodyRef.current?.clientWidth ?? 560) - 32;
      const viewport = page.getViewport({ scale: fit / page.getViewport({ scale: 1 }).width });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      await page.render({ canvas, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] }).promise;
      if (cancelled) return;

      const toCss = (r: Rect): Box => {
        const [x1, y1] = viewport.convertToViewportPoint(r.x, r.y) as number[];
        const [x2, y2] = viewport.convertToViewportPoint(r.x + r.width, r.y + r.height) as number[];
        return { left: Math.min(x1!, x2!), top: Math.min(y1!, y2!), width: Math.abs(x2! - x1!), height: Math.abs(y2! - y1!) };
      };
      const spot = around(props.passage.map(toCss), 10);
      setLayout({ width: viewport.width, height: viewport.height, frames: props.cited.map((r) => around([toCss(r)], 3)!), spot });

      // Bring the passage to the middle of the panel.
      const body = bodyRef.current;
      if (body && spot) {
        const top = spot.top - Math.max(0, (body.clientHeight - spot.height) / 2);
        body.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
      }
    })()
      .catch(() => !cancelled && setFailed(true))
      .finally(() => void task.destroy());
    return () => {
      cancelled = true;
    };
  }, [props.bytes, props.page, props.cited, props.passage]);

  const state = closing ? "closed" : "open";
  const px = (b: Box): CSSProperties => ({ left: b.left, top: b.top, width: b.width, height: b.height });
  return (
    <>
      <div className="pv-backdrop" data-state={state} onClick={close} aria-hidden />
      <aside className="pv" data-state={state} role="dialog" aria-modal="true" aria-labelledby="pv-title">
        <header className="pv-head">
          <h2 id="pv-title">
            {props.filename} · Page {props.page}
          </h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={close} aria-label="Close the page">
            <XIcon weight="bold" aria-hidden />
          </button>
        </header>
        <div className="pv-body" ref={bodyRef} tabIndex={0} aria-label={`Page ${props.page}, the cited passage in focus`}>
          <div className="pv-page" style={layout ? { width: layout.width, height: layout.height } : undefined} data-ready={layout ? "" : undefined}>
            <canvas ref={canvasRef} style={layout ? { width: layout.width, height: layout.height } : undefined} />
            {layout?.spot && <div className="pv-spot" style={px(layout.spot)} />}
            {layout?.frames.map((f, i) => <div key={i} className="pv-frame" style={px(f)} />)}
          </div>
          {!layout && !failed && <p className="pv-note">Rendering the page…</p>}
          {failed && <p className="pv-note">This page could not be rendered. The quotes on the sheet are still exact.</p>}
        </div>
        <p className="pv-foot">
          {props.cited.length} framed {props.cited.length === 1 ? "line" : "lines"} · the rest of the page is dimmed
        </p>
      </aside>
    </>
  );
}
