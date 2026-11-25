/** Board ids appear in URLs, so keep them short and URL-safe. */
export const BOARD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidBoardId(id: string): boolean {
  return BOARD_ID_PATTERN.test(id);
}

export const ELEMENT_TYPES = ["note", "rectangle", "ellipse"] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];

export const ELEMENT_COLORS = ["yellow", "pink", "blue", "green", "purple"] as const;

export type ElementColor = (typeof ELEMENT_COLORS)[number];

export const DEFAULT_ELEMENT_SIZE: Record<ElementType, { width: number; height: number }> = {
  note: { width: 200, height: 200 },
  rectangle: { width: 240, height: 160 },
  ellipse: { width: 200, height: 200 },
};

export const DEFAULT_ELEMENT_COLOR: Record<ElementType, ElementColor> = {
  note: "yellow",
  rectangle: "blue",
  ellipse: "green",
};

/**
 * Anything placed on the board: a sticky note or a shape.
 * `x` / `y` are WORLD coordinates of the top-left corner: they never change
 * when someone pans or zooms their view.
 */
export interface BoardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: ElementColor;
}

/**
 * An arrow between two elements. It stores only WHICH elements it connects, not where it
 * is drawn: the line is computed from the elements' current positions, so it follows
 * them when they are moved or resized.
 */
export interface BoardConnector {
  id: string;
  /** Id of the element the arrow starts at. */
  from: string;
  /** Id of the element the arrow points to. */
  to: string;
}

/** Everything that is shared between users of a board. */
export interface BoardDocument {
  elements: BoardElement[];
  connectors: BoardConnector[];
}
