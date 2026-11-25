import type { BoardElement } from "@collab-board/shared";
import { describe, expect, it } from "vitest";
import {
  boardReducer,
  canConnect,
  createConnector,
  createElement,
  type BoardState,
} from "./board-reducer";

function element(id: string, overrides: Partial<BoardElement> = {}): BoardElement {
  return {
    id,
    type: "note",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    text: "",
    color: "yellow",
    ...overrides,
  };
}

const state: BoardState = {
  elements: [element("a"), element("b"), element("c")],
  connectors: [
    { id: "a->b", from: "a", to: "b" },
    { id: "b->c", from: "b", to: "c" },
  ],
};

const ids = (s: BoardState) => s.elements.map((el) => el.id);

describe("boardReducer", () => {
  it("adds an element on top", () => {
    const next = boardReducer(state, { type: "addElement", element: element("d") });
    expect(ids(next)).toEqual(["a", "b", "c", "d"]);
  });

  it("moves only the targeted element", () => {
    const next = boardReducer(state, { type: "moveElement", id: "b", x: 50, y: -20 });
    expect(next.elements[1]).toMatchObject({ id: "b", x: 50, y: -20 });
    expect(next.elements[0]).toBe(state.elements[0]);
  });

  it("resizes an element", () => {
    const rect = { x: 10, y: 20, width: 300, height: 40 };
    const next = boardReducer(state, { type: "resizeElement", id: "a", rect });
    expect(next.elements[0]).toMatchObject(rect);
  });

  it("updates text and color", () => {
    let next = boardReducer(state, { type: "updateElementText", id: "c", text: "Hello" });
    next = boardReducer(next, { type: "setElementColor", id: "c", color: "pink" });
    expect(next.elements[2]).toMatchObject({ text: "Hello", color: "pink" });
  });

  it("deletes an element together with its arrows", () => {
    const next = boardReducer(state, { type: "deleteElement", id: "b" });
    expect(ids(next)).toEqual(["a", "c"]);
    expect(next.connectors).toEqual([]);
  });

  it("brings an element to the front", () => {
    const next = boardReducer(state, { type: "bringToFront", id: "a" });
    expect(ids(next)).toEqual(["b", "c", "a"]);
  });

  it("returns the same state when the element is already on top", () => {
    expect(boardReducer(state, { type: "bringToFront", id: "c" })).toBe(state);
  });

  it("ignores unknown ids", () => {
    const next = boardReducer(state, { type: "bringToFront", id: "missing" });
    expect(next).toBe(state);
  });

  it("never mutates the previous state", () => {
    const snapshot = structuredClone(state);
    boardReducer(state, { type: "moveElement", id: "a", x: 1, y: 1 });
    boardReducer(state, { type: "deleteElement", id: "a" });
    expect(state).toEqual(snapshot);
  });
});

describe("connectors", () => {
  it("adds an arrow between two elements", () => {
    const connector = { id: "a->c", from: "a", to: "c" };
    const next = boardReducer(state, { type: "addConnector", connector });
    expect(next.connectors).toContainEqual(connector);
  });

  it("rejects self-loops, duplicates and missing elements", () => {
    expect(canConnect(state, "a", "a")).toBe(false);
    expect(canConnect(state, "a", "b")).toBe(false);
    expect(canConnect(state, "a", "missing")).toBe(false);
    expect(canConnect(state, "b", "a")).toBe(true); // the opposite direction is fine

    const duplicate = { id: "dup", from: "a", to: "b" };
    expect(boardReducer(state, { type: "addConnector", connector: duplicate })).toBe(state);
  });

  it("deletes an arrow but keeps the elements", () => {
    const next = boardReducer(state, { type: "deleteConnector", id: "a->b" });
    expect(next.connectors.map((c) => c.id)).toEqual(["b->c"]);
    expect(next.elements).toBe(state.elements);
  });

  it("creates connectors with unique ids", () => {
    expect(createConnector("a", "b")).toMatchObject({ from: "a", to: "b" });
    expect(createConnector("a", "b").id).not.toBe(createConnector("a", "b").id);
  });
});

describe("createElement", () => {
  const rect = { x: 1, y: 2, width: 3, height: 4 };

  it("uses the default color for the element type", () => {
    expect(createElement("rectangle", rect)).toMatchObject({
      type: "rectangle",
      ...rect,
      text: "",
      color: "blue",
    });
  });

  it("generates unique ids", () => {
    expect(createElement("note", rect).id).not.toBe(createElement("note", rect).id);
  });
});
