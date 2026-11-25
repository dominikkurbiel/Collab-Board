"use client";

import type { BoardNote, NoteColor } from "@collab-board/shared";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import styles from "../board.module.css";
import { boardReducer, createNote } from "../board-reducer";
import { getLocalPoint, useViewport } from "../use-viewport";
import { INITIAL_VIEWPORT, fitToContent, screenToWorld, zoomAt, type Point } from "../viewport";
import { StickyNote } from "./StickyNote";
import { Toolbar } from "./Toolbar";

const GRID_SIZE = 24;
const ZOOM_STEP = 1.2;

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function Board({ initialNotes }: { initialNotes: BoardNote[] }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(boardReducer, { notes: initialNotes, selectedId: null });
  const { viewport, setViewport, isPanning, panHandlers } = useViewport(boardRef);

  // Always-current viewport for callbacks that must stay stable (memoized notes)
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  /** Converts a mouse position (clientX/clientY) to WORLD coordinates using the current view. */
  const clientToWorld = useCallback((clientX: number, clientY: number): Point => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    return screenToWorld(viewportRef.current, getLocalPoint(board, clientX, clientY));
  }, []);

  const selectedNote = state.notes.find((note) => note.id === state.selectedId) ?? null;

  // Board size in screen pixels, kept up to date when the window is resized
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(() =>
      setBoardSize({ width: board.clientWidth, height: board.clientHeight }),
    );
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const getBoardCenter = (): Point => ({ x: boardSize.width / 2, y: boardSize.height / 2 });

  // Stable callbacks, so memoized notes don't re-render when the board does
  const selectNote = useCallback((id: string) => dispatch({ type: "selectNote", id }), []);
  const moveNote = useCallback(
    (id: string, x: number, y: number) => dispatch({ type: "moveNote", id, x, y }),
    [],
  );
  const deleteNote = useCallback((id: string) => dispatch({ type: "deleteNote", id }), []);
  const changeText = useCallback(
    (id: string, text: string) => dispatch({ type: "updateNoteText", id, text }),
    [],
  );

  // Keyboard shortcuts (ignored while typing in a note)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if ((event.key === "Delete" || event.key === "Backspace") && state.selectedId) {
        dispatch({ type: "deleteNote", id: state.selectedId });
      } else if (event.key === "Escape") {
        dispatch({ type: "selectNote", id: null });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.selectedId]);

  const handleBackgroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) dispatch({ type: "selectNote", id: null });
    panHandlers.onPointerDown(event);
  };

  const handleBackgroundDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    // Mouse gives SCREEN coordinates; the note is stored in WORLD coordinates
    const screenPoint = getLocalPoint(event.currentTarget, event.clientX, event.clientY);
    dispatch({ type: "addNote", note: createNote(screenToWorld(viewport, screenPoint)) });
  };

  const addNoteInCenter = () => {
    dispatch({ type: "addNote", note: createNote(screenToWorld(viewport, getBoardCenter())) });
  };

  const changeColor = (color: NoteColor) => {
    if (state.selectedId) dispatch({ type: "setNoteColor", id: state.selectedId, color });
  };

  const viewCenter = screenToWorld(viewport, getBoardCenter());
  const gridSize = GRID_SIZE * viewport.zoom;

  return (
    <div className={styles.container}>
      <div
        ref={boardRef}
        className={`${styles.board} ${isPanning ? styles.panning : ""}`}
        style={{
          // The dot grid moves and scales with the view, so the board feels infinite
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
        {...panHandlers}
        onPointerDown={handleBackgroundPointerDown}
        onDoubleClick={handleBackgroundDoubleClick}
      >
        {/* The "world": one transform moves and scales every note at once */}
        <div
          className={styles.world}
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          {state.notes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              viewport={viewport}
              clientToWorld={clientToWorld}
              selected={note.id === state.selectedId}
              onSelect={selectNote}
              onMove={moveNote}
              onChangeText={changeText}
            />
          ))}
        </div>
      </div>

      <Toolbar
        zoom={viewport.zoom}
        selectedId={state.selectedId}
        selectedColor={selectedNote?.color ?? null}
        onAddNote={addNoteInCenter}
        onColorChange={changeColor}
        onDeleteSelected={() => state.selectedId && deleteNote(state.selectedId)}
        onZoomIn={() => setViewport((v) => zoomAt(v, getBoardCenter(), ZOOM_STEP))}
        onZoomOut={() => setViewport((v) => zoomAt(v, getBoardCenter(), 1 / ZOOM_STEP))}
        onResetView={() => setViewport(INITIAL_VIEWPORT)}
        onZoomToFit={() => setViewport(fitToContent(state.notes, boardSize))}
      />

      <div className={styles.position} aria-live="polite">
        x: {Math.round(viewCenter.x)}, y: {Math.round(viewCenter.y)}
      </div>

      <p className={styles.hint}>
        Double-click to add a note · drag to move · scroll to pan · ⌘/Ctrl + scroll to zoom
      </p>
    </div>
  );
}
