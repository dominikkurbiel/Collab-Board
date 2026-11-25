import {
  DEFAULT_ELEMENT_COLOR,
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

export interface BoardState {
  /** Render order: the last element is drawn on top. */
  elements: BoardElement[];
}

export type BoardAction =
  | { type: "addElement"; element: BoardElement }
  | { type: "moveElement"; id: string; x: number; y: number }
  | { type: "resizeElement"; id: string; rect: Rect }
  | { type: "updateElementText"; id: string; text: string }
  | { type: "setElementColor"; id: string; color: ElementColor }
  | { type: "deleteElement"; id: string }
  | { type: "bringToFront"; id: string };

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "addElement":
      return { elements: [...state.elements, action.element] };

    case "moveElement":
      return updateElement(state, action.id, { x: action.x, y: action.y });

    case "resizeElement":
      return updateElement(state, action.id, action.rect);

    case "updateElementText":
      return updateElement(state, action.id, { text: action.text });

    case "setElementColor":
      return updateElement(state, action.id, { color: action.color });

    case "deleteElement":
      return { elements: state.elements.filter((el) => el.id !== action.id) };

    case "bringToFront": {
      const element = state.elements.find((el) => el.id === action.id);
      if (!element || state.elements.at(-1) === element) return state;
      return { elements: [...state.elements.filter((el) => el.id !== action.id), element] };
    }
  }
}

function updateElement(state: BoardState, id: string, changes: Partial<BoardElement>): BoardState {
  return {
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
