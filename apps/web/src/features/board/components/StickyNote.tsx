"use client";

import type { BoardNote } from "@collab-board/shared";
import { memo, useEffect, useRef, useState } from "react";
import styles from "../board.module.css";
import type { Point, Viewport } from "../viewport";

interface StickyNoteProps {
  note: BoardNote;
  viewport: Viewport;
  selected: boolean;
  clientToWorld: (clientX: number, clientY: number) => Point;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onChangeText: (id: string, text: string) => void;
}

interface DragState {
  /** Where inside the note it was grabbed, in WORLD units (keeps the grab point under the cursor). */
  grabOffset: Point;
  /** Last known mouse position, so we can re-position when the view changes mid-drag. */
  clientX: number;
  clientY: number;
}

export const StickyNote = memo(function StickyNote({
  note,
  viewport,
  selected,
  clientToWorld,
  onSelect,
  onMove,
  onChangeText,
}: StickyNoteProps) {
  const [editing, setEditing] = useState(false);
  const drag = useRef<DragState | null>(null);

  /** Puts the note under the cursor: cursor in world coords minus where we grabbed it. */
  const followCursor = (clientX: number, clientY: number) => {
    const state = drag.current;
    if (!state) return;
    const pointer = clientToWorld(clientX, clientY);
    onMove(note.id, pointer.x - state.grabOffset.x, pointer.y - state.grabOffset.y);
  };

  // Zooming or scrolling while holding a note changes the view but not the mouse
  // position, so recompute where the note should be.
  useEffect(() => {
    if (drag.current) followCursor(drag.current.clientX, drag.current.clientY);
    // Intentionally only re-run on view changes, not on every note change
  }, [viewport]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editing || event.button !== 0) return;
    event.stopPropagation();
    onSelect(note.id);
    event.currentTarget.setPointerCapture(event.pointerId);

    const pointer = clientToWorld(event.clientX, event.clientY);
    drag.current = {
      grabOffset: { x: pointer.x - note.x, y: pointer.y - note.y },
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

  return (
    <div
      className={`${styles.note} ${styles[note.color]} ${selected ? styles.selected : ""}`}
      style={{ left: note.x, top: note.y, width: note.width, height: note.height }}
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
          className={styles.noteInput}
          value={note.text}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChangeText(note.id, event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur();
          }}
        />
      ) : (
        <p className={note.text ? styles.noteText : `${styles.noteText} ${styles.placeholder}`}>
          {note.text || "Double-click to edit"}
        </p>
      )}
    </div>
  );
});
