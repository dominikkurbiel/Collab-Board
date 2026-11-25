"use client";

import { DEFAULT_ELEMENT_SIZE, type BoardElement, type ElementColor } from "@collab-board/shared";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import styles from "../board.module.css";
import { boardReducer, createElement } from "../board-reducer";
import { useBoardUi, type Tool } from "../ui-store";
import { getLocalPoint, useViewport } from "../use-viewport";
import {
  INITIAL_VIEWPORT,
  centeredRect,
  fitToContent,
  rectFromPoints,
  screenToWorld,
  zoomAt,
  type Point,
  type Rect,
} from "../viewport";
import { CanvasElement } from "./CanvasElement";
import { SelectionOverlay } from "./SelectionOverlay";
import { Toolbar } from "./Toolbar";

const GRID_SIZE = 24;
const ZOOM_STEP = 1.2;
/** Smaller drags than this (in world units) count as a click: the shape gets its default size. */
const MIN_DRAW_SIZE = 10;

const SHORTCUTS: Record<string, Tool> = { v: "select", n: "note", r: "rectangle", o: "ellipse" };

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function Board({ initialElements }: { initialElements: BoardElement[] }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(boardReducer, { elements: initialElements });
  const { viewport, setViewport, isPanning, panHandlers } = useViewport(boardRef);

  const tool = useBoardUi((s) => s.tool);
  const setTool = useBoardUi((s) => s.setTool);
  const selectedId = useBoardUi((s) => s.selectedId);
  const select = useBoardUi((s) => s.select);

  const selectedElement = state.elements.find((el) => el.id === selectedId) ?? null;

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
  const boardCenter: Point = { x: boardSize.width / 2, y: boardSize.height / 2 };

  /**
   * Mouse position (clientX/clientY) → WORLD coordinates. Reads the view with getState(),
   * so the function never changes and memoized elements don't re-render because of it.
   */
  const clientToWorld = useCallback((clientX: number, clientY: number): Point => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    return screenToWorld(useBoardUi.getState().viewport, getLocalPoint(board, clientX, clientY));
  }, []);

  // --- Document changes (stable callbacks for memoized elements) ---

  const selectElement = useCallback(
    (id: string) => {
      select(id);
      dispatch({ type: "bringToFront", id });
    },
    [select],
  );
  const moveElement = useCallback(
    (id: string, x: number, y: number) => dispatch({ type: "moveElement", id, x, y }),
    [],
  );
  const resizeElement = useCallback(
    (id: string, rect: Rect) => dispatch({ type: "resizeElement", id, rect }),
    [],
  );
  const changeText = useCallback(
    (id: string, text: string) => dispatch({ type: "updateElementText", id, text }),
    [],
  );
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    dispatch({ type: "deleteElement", id: selectedId });
    select(null);
  }, [selectedId, select]);

  const changeColor = (color: ElementColor) => {
    if (selectedId) dispatch({ type: "setElementColor", id: selectedId, color });
  };

  const addElement = (element: BoardElement) => {
    dispatch({ type: "addElement", element });
    select(element.id);
    setTool("select");
  };

  // --- Keyboard shortcuts (ignored while typing) ---

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey) return;

      const shortcutTool = SHORTCUTS[event.key.toLowerCase()];
      if (shortcutTool) {
        setTool(shortcutTool);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      } else if (event.key === "Escape") {
        select(null);
        setTool("select");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, select, setTool]);

  // --- Drawing new elements with a shape / note tool ---

  const drawStart = useRef<Point | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return; // elements handle their own events
    select(null);

    if (tool !== "select" && event.button === 0) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const start = clientToWorld(event.clientX, event.clientY);
      drawStart.current = start;
      setDraft({ ...start, width: 0, height: 0 });
      return;
    }
    panHandlers.onPointerDown(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawStart.current) {
      setDraft(rectFromPoints(drawStart.current, clientToWorld(event.clientX, event.clientY)));
      return;
    }
    panHandlers.onPointerMove(event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drawStart.current;
    if (!start || tool === "select") {
      panHandlers.onPointerUp();
      return;
    }

    let rect = rectFromPoints(start, clientToWorld(event.clientX, event.clientY));
    // A click (or tiny drag) creates an element of the default size centered on the click
    if (rect.width < MIN_DRAW_SIZE || rect.height < MIN_DRAW_SIZE) {
      rect = centeredRect(start, DEFAULT_ELEMENT_SIZE[tool]);
    }
    addElement(createElement(tool, rect));

    drawStart.current = null;
    setDraft(null);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || tool !== "select") return;
    const center = clientToWorld(event.clientX, event.clientY);
    addElement(createElement("note", centeredRect(center, DEFAULT_ELEMENT_SIZE.note)));
  };

  const viewCenter = screenToWorld(viewport, boardCenter);
  const gridSize = GRID_SIZE * viewport.zoom;

  return (
    <div className={styles.container}>
      <div
        ref={boardRef}
        className={[
          styles.board,
          isPanning ? styles.panning : "",
          tool !== "select" ? styles.drawing : "",
        ].join(" ")}
        style={{
          // The dot grid moves and scales with the view, so the board feels infinite
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* The "world": one transform moves and scales every element at once */}
        <div
          className={styles.world}
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          {state.elements.map((element) => (
            <CanvasElement
              key={element.id}
              element={element}
              viewport={viewport}
              clientToWorld={clientToWorld}
              onSelect={selectElement}
              onMove={moveElement}
              onChangeText={changeText}
            />
          ))}

          {draft && tool !== "select" && (
            <div
              className={`${styles.draft} ${styles[tool]}`}
              style={{ left: draft.x, top: draft.y, width: draft.width, height: draft.height }}
            />
          )}
        </div>
      </div>

      {selectedElement && (
        <SelectionOverlay
          element={selectedElement}
          viewport={viewport}
          clientToWorld={clientToWorld}
          onResize={resizeElement}
        />
      )}

      <Toolbar
        selectedColor={selectedElement?.color ?? null}
        onColorChange={changeColor}
        onDeleteSelected={deleteSelected}
        onZoomIn={() => setViewport((v) => zoomAt(v, boardCenter, ZOOM_STEP))}
        onZoomOut={() => setViewport((v) => zoomAt(v, boardCenter, 1 / ZOOM_STEP))}
        onResetView={() => setViewport(INITIAL_VIEWPORT)}
        onZoomToFit={() => setViewport(fitToContent(state.elements, boardSize))}
      />

      <div className={styles.position} aria-live="polite">
        x: {Math.round(viewCenter.x)}, y: {Math.round(viewCenter.y)}
      </div>

      <p className={styles.hint}>
        V select · N note · R rectangle · O ellipse · drag to draw · scroll to pan · ⌘/Ctrl + scroll
        to zoom
      </p>
    </div>
  );
}
