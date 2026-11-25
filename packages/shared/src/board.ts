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
