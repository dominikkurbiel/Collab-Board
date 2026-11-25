"use client";

import type { BoardElement } from "@collab-board/shared";
import { memo, useEffect, useRef, useState } from "react";
import styles from "../board.module.css";
import type { Point, Viewport } from "../viewport";

interface CanvasElementProps {
  element: BoardElement;
  viewport: Viewport;
  clientToWorld: (clientX: number, clientY: number) => Point;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onChangeText: (id: string, text: string) => void;
}

interface DragState {
  /** Where inside the element it was grabbed, in WORLD units (keeps that point under the cursor). */
  grabOffset: Point;
  /** Last known mouse position, so we can re-position when the view changes mid-drag. */
  clientX: number;
  clientY: number;
}

/** A sticky note or a shape. Handles dragging and text editing; selection UI is drawn elsewhere. */
export const CanvasElement = memo(function CanvasElement({
  element,
  viewport,
  clientToWorld,
  onSelect,
  onMove,
  onChangeText,
}: CanvasElementProps) {
  const [editing, setEditing] = useState(false);
  const drag = useRef<DragState | null>(null);

  /** Puts the element under the cursor: cursor in world coords minus where we grabbed it. */
  const followCursor = (clientX: number, clientY: number) => {
    const state = drag.current;
    if (!state) return;
    const pointer = clientToWorld(clientX, clientY);
    onMove(element.id, pointer.x - state.grabOffset.x, pointer.y - state.grabOffset.y);
  };

  // Zooming or scrolling while holding an element changes the view but not the mouse
  // position, so recompute where the element should be.
  useEffect(() => {
    if (drag.current) followCursor(drag.current.clientX, drag.current.clientY);
    // Intentionally only re-run on view changes, not on every element change
  }, [viewport]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editing || event.button !== 0) return;
    event.stopPropagation();
    onSelect(element.id);
    event.currentTarget.setPointerCapture(event.pointerId);

    const pointer = clientToWorld(event.clientX, event.clientY);
    drag.current = {
      grabOffset: { x: pointer.x - element.x, y: pointer.y - element.y },
      clientX: event.clientX,
      clientY: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current.clientX = event.clientX;
    drag.current.clientY = event.clientY;
    followCursor(event.clientX, event.clientY);
  };

  const stopDragging = () => {
    drag.current = null;
  };

  const isNote = element.type === "note";

  return (
    <div
      className={`${styles.element} ${styles[element.type]} ${styles[element.color]}`}
      style={{ left: element.x, top: element.y, width: element.width, height: element.height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onDoubleClick={(event) => {
        event.stopPropagation(); // don't create a new note on the board underneath
        setEditing(true);
      }}
    >
      {editing ? (
        <textarea
          className={styles.elementInput}
          value={element.text}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChangeText(element.id, event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur();
          }}
        />
      ) : (
        <p className={`${styles.elementText} ${element.text ? "" : styles.placeholder}`}>
          {element.text || (isNote ? "Double-click to edit" : "")}
        </p>
      )}
    </div>
  );
});
