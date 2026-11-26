"use client";

import {
  DEFAULT_ELEMENT_SIZE,
  canConnect,
  createConnector,
  createElement,
  type BoardElement,
  type ElementColor,
  type ElementType,
} from "@collab-board/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../board.module.css";
import { boundaryPoint, elementAt, rectCenter } from "../geometry";
import { useBoardUi, type Tool } from "../ui-store";
import { useBoardDocument, type ConnectionStatus } from "../use-board-document";
import { CopyLinkButton } from "@/features/sharing/CopyLinkButton";
import { useLocalPresence } from "../use-presence";
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
import { ConnectorLayer, type ConnectorDraft } from "./ConnectorLayer";
import { PresenceList } from "./PresenceList";
import { RemoteCursors } from "./RemoteCursors";
import { SelectionOverlay } from "./SelectionOverlay";
import { Toolbar } from "./Toolbar";

const GRID_SIZE = 24;
const ZOOM_STEP = 1.2;
/** Smaller drags than this (in world units) count as a click: the shape gets its default size. */
const MIN_DRAW_SIZE = 10;

const SHORTCUTS: Record<string, Tool> = {
  v: "select",
  n: "note",
  r: "rectangle",
  o: "ellipse",
  a: "connector",
};

/** Tools that create a new element (as opposed to "select" and "connector"). */
function isElementTool(tool: Tool): tool is ElementType {
  return tool !== "select" && tool !== "connector";
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** An arrow being dragged out of an element. */
interface Connecting {
  fromId: string;
  /** Mouse position in client pixels; converted to world coords on render, so it stays
   *  correct even if the view is zoomed or scrolled mid-drag. */
  clientX: number;
  clientY: number;
}

export function Board({ boardId }: { boardId: string }) {
  const boardRef = useRef<HTMLDivElement>(null);
  // The shared document (synced live with everyone on this board)
  const { board, dispatch, status, awareness } = useBoardDocument(boardId);
  const shareCursor = useLocalPresence(awareness);
  const { viewport, setViewport, isPanning, panHandlers } = useViewport(boardRef);

  const tool = useBoardUi((s) => s.tool);
  const setTool = useBoardUi((s) => s.setTool);
  const selectedId = useBoardUi((s) => s.selectedId);
  const select = useBoardUi((s) => s.select);

  const selectedElement = board.elements.find((el) => el.id === selectedId) ?? null;

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
    [select, dispatch],
  );
  const moveElement = useCallback(
    (id: string, x: number, y: number) => dispatch({ type: "moveElement", id, x, y }),
    [dispatch],
  );
  const resizeElement = useCallback(
    (id: string, rect: Rect) => dispatch({ type: "resizeElement", id, rect }),
    [dispatch],
  );
  const changeText = useCallback(
    (id: string, text: string) => dispatch({ type: "updateElementText", id, text }),
    [dispatch],
  );
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    // The selection can be an element or an arrow
    const isConnector = board.connectors.some((c) => c.id === selectedId);
    dispatch({ type: isConnector ? "deleteConnector" : "deleteElement", id: selectedId });
    select(null);
  }, [selectedId, select, board.connectors, dispatch]);

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

  // --- Drawing: new elements (shape / note tools) and arrows (connector tool) ---

  const drawStart = useRef<Point | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [connecting, setConnecting] = useState<Connecting | null>(null);

  // While dragging an arrow: where the cursor is, and which element it would connect to
  const connectSource = connecting
    ? (board.elements.find((el) => el.id === connecting.fromId) ?? null)
    : null;
  const connectPointer = connecting ? clientToWorld(connecting.clientX, connecting.clientY) : null;
  const hovered = connectPointer ? elementAt(board.elements, connectPointer) : null;
  const connectTarget =
    connectSource && hovered && canConnect(board, connectSource.id, hovered.id) ? hovered : null;

  let connectorDraft: ConnectorDraft | null = null;
  if (connectSource && connectPointer) {
    connectorDraft = {
      from: connectSource,
      // Over a valid target the preview snaps to its outline, so you see the final arrow
      end: connectTarget ? boundaryPoint(connectTarget, rectCenter(connectSource)) : connectPointer,
    };
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return; // elements handle their own events
    select(null);

    if (event.button === 0 && tool === "connector") {
      // In drawing mode elements ignore the mouse, so find the one under the cursor ourselves
      const source = elementAt(board.elements, clientToWorld(event.clientX, event.clientY));
      if (source) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setConnecting({ fromId: source.id, clientX: event.clientX, clientY: event.clientY });
        return;
      }
    } else if (event.button === 0 && isElementTool(tool)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const start = clientToWorld(event.clientX, event.clientY);
      drawStart.current = start;
      setDraft({ ...start, width: 0, height: 0 });
      return;
    }
    panHandlers.onPointerDown(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (connecting) {
      setConnecting({ ...connecting, clientX: event.clientX, clientY: event.clientY });
      return;
    }
    if (drawStart.current) {
      setDraft(rectFromPoints(drawStart.current, clientToWorld(event.clientX, event.clientY)));
      return;
    }
    panHandlers.onPointerMove(event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (connecting) {
      if (connectSource && connectTarget) {
        const connector = createConnector(connectSource.id, connectTarget.id);
        dispatch({ type: "addConnector", connector });
        select(connector.id);
        setTool("select");
      }
      setConnecting(null);
      return;
    }

    const start = drawStart.current;
    if (!start || !isElementTool(tool)) {
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
    <div
      className={styles.container}
      // Share our cursor with others, in world coordinates (also while dragging or resizing)
      onPointerMove={(event) => shareCursor(clientToWorld(event.clientX, event.clientY))}
      onPointerLeave={() => shareCursor(null)}
    >
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
          <ConnectorLayer
            elements={board.elements}
            connectors={board.connectors}
            selectedId={selectedId}
            draft={connectorDraft}
            onSelect={select}
          />

          {board.elements.map((element) => (
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

          {connectTarget && (
            <div
              className={`${styles.connectTarget} ${
                connectTarget.type === "ellipse" ? styles.connectTargetRound : ""
              }`}
              style={{
                left: connectTarget.x,
                top: connectTarget.y,
                width: connectTarget.width,
                height: connectTarget.height,
              }}
            />
          )}

          {draft && isElementTool(tool) && (
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
        onZoomToFit={() => setViewport(fitToContent(board.elements, boardSize))}
      />

      <RemoteCursors awareness={awareness} />

      <div className={styles.topBar}>
        <CopyLinkButton label="Share" />
        <PresenceList awareness={awareness} />
        <ConnectionBadge status={status} />
      </div>

      <div className={styles.position} aria-live="polite">
        x: {Math.round(viewCenter.x)}, y: {Math.round(viewCenter.y)}
      </div>

      <p className={styles.hint}>
        V select · N note · R rectangle · O ellipse · A arrow (drag between elements) · scroll to
        pan · ⌘/Ctrl + scroll to zoom
      </p>
    </div>
  );
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  online: "Live",
  offline: "Offline: changes will sync when you reconnect",
};

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <div className={styles.status} data-status={status} role="status">
      <span className={styles.statusDot} />
      {STATUS_LABELS[status]}
    </div>
  );
}
