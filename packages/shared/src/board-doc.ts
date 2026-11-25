import * as Y from "yjs";
import {
  DEFAULT_ELEMENT_COLOR,
  ELEMENT_COLORS,
  ELEMENT_TYPES,
  type BoardConnector,
  type BoardDocument,
  type BoardElement,
  type ElementColor,
  type ElementType,
} from "./board.js";

/**
 * The board document as a Yjs CRDT, shared by the browser and the server.
 *
 * Layout inside the Y.Doc:
 *   "elements":   Y.Map<id, Y.Map<field, value>>  one nested map per element, so two people
 *                 changing DIFFERENT fields of the same element (one moves it, the other
 *                 edits its text) both keep their change
 *   "connectors": Y.Map<id, BoardConnector>        plain values: an arrow never changes,
 *                 it is only added or deleted
 *
 * Elements also store `z` (drawing order). It is a number instead of an array position
 * because moving items inside a shared array is not safe with concurrent edits.
 */

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Every way the board document can change. */
export type BoardAction =
  | { type: "addElement"; element: BoardElement }
  | { type: "moveElement"; id: string; x: number; y: number }
  | { type: "resizeElement"; id: string; rect: ElementRect }
  | { type: "updateElementText"; id: string; text: string }
  | { type: "setElementColor"; id: string; color: ElementColor }
  | { type: "deleteElement"; id: string }
  | { type: "bringToFront"; id: string }
  | { type: "addConnector"; connector: BoardConnector }
  | { type: "deleteConnector"; id: string };

type YElement = Y.Map<unknown>;

export const EMPTY_BOARD: BoardDocument = { elements: [], connectors: [] };

function getElements(doc: Y.Doc): Y.Map<YElement> {
  return doc.getMap<YElement>("elements");
}

function getConnectors(doc: Y.Doc): Y.Map<BoardConnector> {
  return doc.getMap<BoardConnector>("connectors");
}

// --- Writing ---

/**
 * Applies an action to the Y.Doc in one transaction (= one update sent to other users).
 * `origin` tags the transaction, e.g. so an undo manager can track only local changes.
 */
export function applyBoardAction(doc: Y.Doc, action: BoardAction, origin?: unknown): void {
  const elements = getElements(doc);
  const connectors = getConnectors(doc);

  doc.transact(() => {
    switch (action.type) {
      case "addElement": {
        const { id, ...fields } = action.element;
        const yElement: YElement = new Y.Map();
        for (const [key, value] of Object.entries(fields)) yElement.set(key, value);
        yElement.set("z", maxZ(elements) + 1);
        elements.set(id, yElement);
        break;
      }

      case "moveElement":
        updateElement(elements, action.id, { x: action.x, y: action.y });
        break;

      case "resizeElement":
        updateElement(elements, action.id, { ...action.rect });
        break;

      case "updateElementText":
        updateElement(elements, action.id, { text: action.text });
        break;

      case "setElementColor":
        updateElement(elements, action.id, { color: action.color });
        break;

      case "deleteElement": {
        elements.delete(action.id);
        // An arrow can't point to nothing: remove the ones attached to the deleted element
        const attached = [...connectors.entries()]
          .filter(([, c]) => c.from === action.id || c.to === action.id)
          .map(([connectorId]) => connectorId);
        for (const connectorId of attached) connectors.delete(connectorId);
        break;
      }

      case "bringToFront": {
        const yElement = elements.get(action.id);
        if (!yElement || topElementId(elements) === action.id) break;
        yElement.set("z", maxZ(elements) + 1);
        break;
      }

      case "addConnector": {
        const { id, from, to } = action.connector;
        if (canConnect(readBoard(doc), from, to)) connectors.set(id, { id, from, to });
        break;
      }

      case "deleteConnector":
        connectors.delete(action.id);
        break;
    }
  }, origin);
}

function updateElement(elements: Y.Map<YElement>, id: string, changes: Record<string, unknown>) {
  const yElement = elements.get(id);
  if (!yElement) return;
  for (const [key, value] of Object.entries(changes)) {
    // Skip unchanged fields so we don't send updates that change nothing
    if (yElement.get(key) !== value) yElement.set(key, value);
  }
}

function zOf(yElement: YElement): number {
  const z = yElement.get("z");
  return typeof z === "number" ? z : 0;
}

function maxZ(elements: Y.Map<YElement>): number {
  let max = 0;
  elements.forEach((yElement) => (max = Math.max(max, zOf(yElement))));
  return max;
}

/** Same ordering as readBoard: by z, ties broken by id (two users may pick the same z). */
function compareOrder(a: { z: number; id: string }, b: { z: number; id: string }): number {
  return a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function topElementId(elements: Y.Map<YElement>): string | null {
  let top: { z: number; id: string } | null = null;
  for (const [id, yElement] of elements.entries()) {
    const current = { z: zOf(yElement), id };
    if (!top || compareOrder(current, top) > 0) top = current;
  }
  return top?.id ?? null;
}

/** Loads a whole board (e.g. demo content) into an empty document. */
export function loadBoard(doc: Y.Doc, board: BoardDocument): void {
  doc.transact(() => {
    for (const element of board.elements) applyBoardAction(doc, { type: "addElement", element });
    for (const connector of board.connectors) {
      applyBoardAction(doc, { type: "addConnector", connector });
    }
  });
}

// --- Reading ---

/**
 * Plain snapshot of the Y.Doc for rendering. Elements that didn't change keep the
 * object from `previous`, so memoized React components skip re-rendering them.
 */
export function readBoard(doc: Y.Doc, previous: BoardDocument = EMPTY_BOARD): BoardDocument {
  const previousById = new Map(previous.elements.map((el) => [el.id, el]));

  const ordered: { z: number; id: string; element: BoardElement }[] = [];
  getElements(doc).forEach((yElement, id) => {
    const element = toElement(id, yElement);
    if (!element) return; // ignore malformed data sent by another client
    const old = previousById.get(id);
    ordered.push({
      z: zOf(yElement),
      id,
      element: old && sameElement(old, element) ? old : element,
    });
  });
  ordered.sort(compareOrder);
  const elements = ordered.map((entry) => entry.element);

  const connectors = [...getConnectors(doc).values()]
    .filter(isConnector)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    elements: sameItems(elements, previous.elements) ? previous.elements : elements,
    connectors: sameItems(connectors, previous.connectors) ? previous.connectors : connectors,
  };
}

function toElement(id: string, yElement: YElement): BoardElement | null {
  const type = yElement.get("type");
  const color = yElement.get("color");
  const text = yElement.get("text");
  const x = yElement.get("x");
  const y = yElement.get("y");
  const width = yElement.get("width");
  const height = yElement.get("height");

  if (
    !isOneOf(ELEMENT_TYPES, type) ||
    !isOneOf(ELEMENT_COLORS, color) ||
    typeof text !== "string" ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height)
  ) {
    return null;
  }
  return { id, type, x, y, width, height, text, color };
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isConnector(value: unknown): value is BoardConnector {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.from === "string" && typeof c.to === "string";
}

function sameElement(a: BoardElement, b: BoardElement): boolean {
  return (Object.keys(a) as (keyof BoardElement)[]).every((key) => a[key] === b[key]);
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

// --- Rules and factories ---

/**
 * An arrow is allowed between two different, existing elements that aren't
 * already connected in this direction.
 */
export function canConnect(board: BoardDocument, from: string, to: string): boolean {
  return (
    from !== to &&
    board.elements.some((el) => el.id === from) &&
    board.elements.some((el) => el.id === to) &&
    !board.connectors.some((c) => c.from === from && c.to === to)
  );
}

export function createElement(
  type: ElementType,
  rect: ElementRect,
  color: ElementColor = DEFAULT_ELEMENT_COLOR[type],
): BoardElement {
  return { id: crypto.randomUUID(), type, ...rect, text: "", color };
}

export function createConnector(from: string, to: string): BoardConnector {
  return { id: crypto.randomUUID(), from, to };
}
