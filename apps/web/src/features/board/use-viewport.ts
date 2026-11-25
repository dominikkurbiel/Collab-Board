"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { INITIAL_VIEWPORT, panBy, zoomAt, type Point, type Viewport } from "./viewport";

const LINE_HEIGHT_PX = 16;
const ZOOM_SPEED = 0.01;

/** Mouse position relative to the board element. */
export function getLocalPoint(element: HTMLElement, clientX: number, clientY: number): Point {
  const rect = element.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/**
 * Pan & zoom for the infinite canvas:
 * - wheel / two-finger trackpad scroll → pan
 * - Ctrl/Cmd + wheel, trackpad pinch → zoom towards the cursor
 * - dragging the empty background → pan
 */
export function useViewport(boardRef: RefObject<HTMLElement | null>) {
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [isPanning, setIsPanning] = useState(false);
  const lastPointer = useRef<Point | null>(null);

  // React's onWheel is passive, so it can't preventDefault() the browser's own
  // scroll / page zoom. A native listener with { passive: false } can.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT_PX : 1;
      const dx = event.deltaX * scale;
      const dy = event.deltaY * scale;

      // Trackpad pinch is reported as a wheel event with ctrlKey = true
      if (event.ctrlKey || event.metaKey) {
        const point = getLocalPoint(board, event.clientX, event.clientY);
        setViewport((v) => zoomAt(v, point, Math.exp(-dy * ZOOM_SPEED)));
      } else {
        setViewport((v) => panBy(v, -dx, -dy));
      }
    };

    board.addEventListener("wheel", onWheel, { passive: false });
    return () => board.removeEventListener("wheel", onWheel);
  }, [boardRef]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    // Only the empty background starts panning (notes handle their own dragging)
    if (event.target !== event.currentTarget) return;
    if (event.button !== 0 && event.button !== 1) return;

    // Pointer capture: we keep receiving move events even if the cursor
    // leaves the element or the browser window while dragging
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setIsPanning(true);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const last = lastPointer.current;
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setViewport((v) => panBy(v, dx, dy));
  }, []);

  const stopPanning = useCallback(() => {
    lastPointer.current = null;
    setIsPanning(false);
  }, []);

  return {
    viewport,
    setViewport,
    isPanning,
    panHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stopPanning,
      onPointerCancel: stopPanning,
    },
  };
}
