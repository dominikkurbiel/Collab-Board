import {
  DEFAULT_ELEMENT_COLOR,
  type BoardConnector,
  type BoardDocument,
  type BoardElement,
  type ElementColor,
  type ElementType,
} from "@collab-board/shared";
import type { Rect } from "./viewport";

/**
 * The board DOCUMENT (what everyone sees) and all the ways it can change.
 * Pure functions, no React: when real-time sync (Yjs) arrives, only the source of
 * this state changes. Per-user UI state (tool, view, selection) lives in ui-store.ts.
 */

/** `elements` are in render order: the last one is drawn on top. */
export type BoardState = BoardDocument;

export type BoardAction =
  | { type: "addElement"; element: BoardElement }
  | { type: "moveElement"; id: string; x: number; y: number }
  | { type: "resizeElement"; id: string; rect: Rect }
  | { type: "updateElementText"; id: string; text: string }
  | { type: "setElementColor"; id: string; color: ElementColor }
  | { type: "deleteElement"; id: string }
  | { type: "bringToFront"; id: string }
  | { type: "addConnector"; connector: BoardConnector }
  | { type: "deleteConnector"; id: string };

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "addElement":
      return { ...state, elements: [...state.elements, action.element] };

    case "moveElement":
      return updateElement(state, action.id, { x: action.x, y: action.y });

    case "resizeElement":
      return updateElement(state, action.id, action.rect);

    case "updateElementText":
      return updateElement(state, action.id, { text: action.text });

    case "setElementColor":
      return updateElement(state, action.id, { color: action.color });

    case "deleteElement":
      // An arrow can't point to nothing: remove the ones attached to the deleted element
      return {
        elements: state.elements.filter((el) => el.id !== action.id),
        connectors: state.connectors.filter((c) => c.from !== action.id && c.to !== action.id),
      };

    case "bringToFront": {
      const element = state.elements.find((el) => el.id === action.id);
      if (!element || state.elements.at(-1) === element) return state;
      return {
        ...state,
        elements: [...state.elements.filter((el) => el.id !== action.id), element],
      };
    }

    case "addConnector": {
      const { from, to } = action.connector;
      return canConnect(state, from, to)
        ? { ...state, connectors: [...state.connectors, action.connector] }
        : state;
    }

    case "deleteConnector":
      return { ...state, connectors: state.connectors.filter((c) => c.id !== action.id) };
  }
}

function updateElement(state: BoardState, id: string, changes: Partial<BoardElement>): BoardState {
  return {
    ...state,
    elements: state.elements.map((el) => (el.id === id ? { ...el, ...changes } : el)),
  };
}

export function createElement(
  type: ElementType,
  rect: Rect,
  color: ElementColor = DEFAULT_ELEMENT_COLOR[type],
): BoardElement {
  return { id: crypto.randomUUID(), type, ...rect, text: "", color };
}

/**
 * An arrow is allowed between two different, existing elements that aren't
 * already connected in this direction.
 */
export function canConnect(state: BoardState, from: string, to: string): boolean {
  return (
    from !== to &&
    state.elements.some((el) => el.id === from) &&
    state.elements.some((el) => el.id === to) &&
    !state.connectors.some((c) => c.from === from && c.to === to)
  );
}

export function createConnector(from: string, to: string): BoardConnector {
  return { id: crypto.randomUUID(), from, to };
}
