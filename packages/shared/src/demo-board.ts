import type { BoardDocument, BoardElement } from "./board.js";

/** Id of the public demo board, the one linked from the home page. */
export const DEMO_BOARD_ID = "demo";

/** Starting content of the demo board, loaded by the server when the room is created. */
const DEMO_ELEMENTS: BoardElement[] = [
  {
    id: "demo-1",
    type: "note",
    x: 120,
    y: 140,
    width: 200,
    height: 200,
    text: "Welcome to Collab Board 👋",
    color: "yellow",
  },
  {
    id: "demo-2",
    type: "note",
    x: 380,
    y: 180,
    width: 200,
    height: 200,
    text: "Drag me around",
    color: "pink",
  },
  {
    id: "demo-3",
    type: "rectangle",
    x: 660,
    y: 120,
    width: 260,
    height: 150,
    text: "Pick a shape in the toolbar and drag to draw",
    color: "blue",
  },
  {
    id: "demo-4",
    type: "ellipse",
    x: 700,
    y: 330,
    width: 200,
    height: 200,
    text: "Resize me with the corner handles",
    color: "green",
  },
  {
    id: "demo-5",
    type: "note",
    x: 260,
    y: 440,
    width: 200,
    height: 200,
    text: "Scroll to pan, ⌘/Ctrl + scroll to zoom",
    color: "blue",
  },
];

export const DEMO_BOARD: BoardDocument = {
  elements: DEMO_ELEMENTS,
  connectors: [
    { id: "demo-arrow-1", from: "demo-1", to: "demo-2" },
    { id: "demo-arrow-2", from: "demo-3", to: "demo-4" },
  ],
};
