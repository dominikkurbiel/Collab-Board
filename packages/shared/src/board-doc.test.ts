import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { BoardDocument, BoardElement } from "./board.js";
import {
  applyBoardAction,
  canConnect,
  createConnector,
  createElement,
  loadBoard,
  readBoard,
  type BoardAction,
} from "./board-doc.js";

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

const initialBoard: BoardDocument = {
  elements: [element("a"), element("b"), element("c")],
  connectors: [
    { id: "a->b", from: "a", to: "b" },
    { id: "b->c", from: "b", to: "c" },
  ],
};

function createDoc(board: BoardDocument = initialBoard): Y.Doc {
  const doc = new Y.Doc();
  loadBoard(doc, board);
  return doc;
}

/** Applies an action to a fresh document and returns the resulting snapshot. */
function apply(action: BoardAction, doc = createDoc()): BoardDocument {
  applyBoardAction(doc, action);
  return readBoard(doc);
}

const ids = (board: BoardDocument) => board.elements.map((el) => el.id);

describe("loadBoard / readBoard", () => {
  it("round-trips a board", () => {
    expect(readBoard(createDoc())).toEqual(initialBoard);
  });

  it("ignores malformed elements written by another client", () => {
    const doc = createDoc();
    const broken = new Y.Map<unknown>();
    broken.set("type", "triangle");
    doc.getMap("elements").set("broken", broken);
    expect(ids(readBoard(doc))).toEqual(["a", "b", "c"]);
  });

  it("reuses unchanged element objects (cheap React re-renders)", () => {
    const doc = createDoc();
    const before = readBoard(doc);
    applyBoardAction(doc, { type: "moveElement", id: "b", x: 50, y: 50 });
    const after = readBoard(doc, before);

    expect(after.elements[0]).toBe(before.elements[0]);
    expect(after.elements[1]).not.toBe(before.elements[1]);
    expect(after.connectors).toBe(before.connectors);
  });
});

describe("element actions", () => {
  it("adds an element on top", () => {
    expect(ids(apply({ type: "addElement", element: element("d") }))).toEqual(["a", "b", "c", "d"]);
  });

  it("moves, resizes, edits text and changes color", () => {
    const doc = createDoc();
    applyBoardAction(doc, { type: "moveElement", id: "b", x: 50, y: -20 });
    applyBoardAction(doc, {
      type: "resizeElement",
      id: "a",
      rect: { x: 10, y: 20, width: 300, height: 40 },
    });
    applyBoardAction(doc, { type: "updateElementText", id: "c", text: "Hello" });
    applyBoardAction(doc, { type: "setElementColor", id: "c", color: "pink" });

    const [a, b, c] = readBoard(doc).elements;
    expect(a).toMatchObject({ x: 10, y: 20, width: 300, height: 40 });
    expect(b).toMatchObject({ x: 50, y: -20 });
    expect(c).toMatchObject({ text: "Hello", color: "pink" });
  });

  it("deletes an element together with its arrows", () => {
    const board = apply({ type: "deleteElement", id: "b" });
    expect(ids(board)).toEqual(["a", "c"]);
    expect(board.connectors).toEqual([]);
  });

  it("brings an element to the front", () => {
    expect(ids(apply({ type: "bringToFront", id: "a" }))).toEqual(["b", "c", "a"]);
  });

  it("does not send an update when nothing changes", () => {
    const doc = createDoc();
    let updates = 0;
    doc.on("update", () => updates++);

    applyBoardAction(doc, { type: "bringToFront", id: "c" }); // already on top
    applyBoardAction(doc, { type: "moveElement", id: "a", x: 0, y: 0 }); // same position
    applyBoardAction(doc, { type: "moveElement", id: "missing", x: 1, y: 1 });

    expect(updates).toBe(0);
  });
});

describe("connector actions", () => {
  it("adds an arrow between two elements", () => {
    const connector = { id: "a->c", from: "a", to: "c" };
    expect(apply({ type: "addConnector", connector }).connectors).toContainEqual(connector);
  });

  it("rejects self-loops, duplicates and missing elements", () => {
    const board = readBoard(createDoc());
    expect(canConnect(board, "a", "a")).toBe(false);
    expect(canConnect(board, "a", "b")).toBe(false);
    expect(canConnect(board, "a", "missing")).toBe(false);
    expect(canConnect(board, "b", "a")).toBe(true); // the opposite direction is fine

    const duplicate = { id: "dup", from: "a", to: "b" };
    expect(apply({ type: "addConnector", connector: duplicate }).connectors).toHaveLength(2);
  });

  it("deletes an arrow but keeps the elements", () => {
    const board = apply({ type: "deleteConnector", id: "a->b" });
    expect(board.connectors.map((c) => c.id)).toEqual(["b->c"]);
    expect(ids(board)).toEqual(["a", "b", "c"]);
  });
});

describe("concurrent editing (CRDT)", () => {
  /** Two users with their own copy of the same board, like two browser tabs. */
  function twoUsers() {
    const alice = createDoc();
    const bob = new Y.Doc();
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));
    return { alice, bob };
  }

  /** Exchanges all changes in both directions, like the WebSocket server does. */
  function sync(a: Y.Doc, b: Y.Doc) {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
  }

  it("keeps both changes when two users edit different fields of one element", () => {
    const { alice, bob } = twoUsers();

    // Both edit "a" at the same time, while offline from each other
    applyBoardAction(alice, { type: "moveElement", id: "a", x: 500, y: 500 });
    applyBoardAction(bob, { type: "updateElementText", id: "a", text: "Bob was here" });
    sync(alice, bob);

    const expected = { x: 500, y: 500, text: "Bob was here" };
    expect(readBoard(alice).elements[0]).toMatchObject(expected);
    expect(readBoard(bob)).toEqual(readBoard(alice));
  });

  it("ends up in the same state no matter who changed what", () => {
    const { alice, bob } = twoUsers();

    applyBoardAction(alice, { type: "addElement", element: element("from-alice") });
    applyBoardAction(alice, { type: "bringToFront", id: "a" });
    applyBoardAction(bob, { type: "addElement", element: element("from-bob") });
    applyBoardAction(bob, { type: "setElementColor", id: "a", color: "green" });
    applyBoardAction(bob, { type: "deleteElement", id: "c" });
    sync(alice, bob);

    expect(readBoard(bob)).toEqual(readBoard(alice));
    expect(ids(readBoard(alice))).toEqual(expect.arrayContaining(["from-alice", "from-bob"]));
    expect(ids(readBoard(alice))).not.toContain("c");
  });
});

describe("factories", () => {
  const rect = { x: 1, y: 2, width: 3, height: 4 };

  it("creates an element with the default color for its type", () => {
    expect(createElement("rectangle", rect)).toMatchObject({
      type: "rectangle",
      ...rect,
      text: "",
      color: "blue",
    });
  });

  it("generates unique ids", () => {
    expect(createElement("note", rect).id).not.toBe(createElement("note", rect).id);
    expect(createConnector("a", "b").id).not.toBe(createConnector("a", "b").id);
  });
});
