"use client";

import type { BoardElement } from "@collab-board/shared";
import { useRef } from "react";
import styles from "../board.module.css";
import { rectFromPoints, worldToScreen, type Point, type Rect, type Viewport } from "../viewport";

const MIN_SIZE = 40;

const CORNERS = ["nw", "ne", "sw", "se"] as const;
type Corner = (typeof CORNERS)[number];

/** The corner that stays in place while dragging the given handle. */
function oppositeCorner(rect: Rect, corner: Corner): Point {
  return {
    x: corner === "nw" || corner === "sw" ? rect.x + rect.width : rect.x,
    y: corner === "nw" || corner === "ne" ? rect.y + rect.height : rect.y,
  };
}

interface SelectionOverlayProps {
  element: BoardElement;
  viewport: Viewport;
  clientToWorld: (clientX: number, clientY: number) => Point;
  onResize: (id: string, rect: Rect) => void;
}

/**
 * Selection outline + resize handles, drawn in SCREEN space on top of the board.
 * Because it isn't inside the zoomed "world", the handles keep the same size at any zoom.
 */
export function SelectionOverlay({
  element,
  viewport,
  clientToWorld,
  onResize,
}: SelectionOverlayProps) {
  const fixedCorner = useRef<Point | null>(null);

  const topLeft = worldToScreen(viewport, element);

  const startResize = (event: React.PointerEvent<HTMLDivElement>, corner: Corner) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    fixedCorner.current = oppositeCorner(element, corner);
  };

  const resize = (event: React.PointerEvent<HTMLDivElement>) => {
    const fixed = fixedCorner.current;
    if (!fixed) return;
    const rect = rectFromPoints(fixed, clientToWorld(event.clientX, event.clientY));
    onResize(element.id, {
      ...rect,
      width: Math.max(MIN_SIZE, rect.width),
      height: Math.max(MIN_SIZE, rect.height),
    });
  };

  const stopResize = () => {
    fixedCorner.current = null;
  };

  return (
    <div
      className={styles.selection}
      style={{
        left: topLeft.x,
        top: topLeft.y,
        width: element.width * viewport.zoom,
        height: element.height * viewport.zoom,
      }}
    >
      {CORNERS.map((corner) => (
        <div
          key={corner}
          className={`${styles.handle} ${styles[corner]}`}
          onPointerDown={(event) => startResize(event, corner)}
          onPointerMove={resize}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
        />
      ))}
    </div>
  );
}
