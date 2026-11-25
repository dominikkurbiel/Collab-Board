import type { BoardElement } from "@collab-board/shared";
import type { Point, Rect } from "./viewport";

/**
 * Pure geometry of board elements, in WORLD coordinates: hit testing and
 * where connector arrows touch an element's outline.
 */

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Is the point inside the element? Ellipses use their real curved outline. */
export function containsPoint(element: BoardElement, point: Point): boolean {
  if (element.type === "ellipse") {
    const center = rectCenter(element);
    const nx = (point.x - center.x) / (element.width / 2);
    const ny = (point.y - center.y) / (element.height / 2);
    return nx * nx + ny * ny <= 1;
  }
  return (
    point.x >= element.x &&
    point.x <= element.x + element.width &&
    point.y >= element.y &&
    point.y <= element.y + element.height
  );
}

/** The topmost element under the point (later elements are drawn on top), or null. */
export function elementAt(elements: readonly BoardElement[], point: Point): BoardElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (element && containsPoint(element, point)) return element;
  }
  return null;
}

/**
 * Where a ray from the element's center towards `target` crosses the element's outline.
 * This is where an arrow starts or ends, so it touches the edge instead of the center.
 */
export function boundaryPoint(element: BoardElement, target: Point): Point {
  const center = rectCenter(element);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;

  const halfWidth = element.width / 2;
  const halfHeight = element.height / 2;

  // Scale factor t so that center + t * (dx, dy) lies exactly on the outline
  const t =
    element.type === "ellipse"
      ? 1 / Math.hypot(dx / halfWidth, dy / halfHeight)
      : Math.min(
          dx === 0 ? Infinity : halfWidth / Math.abs(dx),
          dy === 0 ? Infinity : halfHeight / Math.abs(dy),
        );

  return { x: center.x + dx * t, y: center.y + dy * t };
}

/** Start and end of an arrow from one element to another, on their outlines. */
export function connectorEndpoints(
  from: BoardElement,
  to: BoardElement,
): { start: Point; end: Point } {
  return {
    start: boundaryPoint(from, rectCenter(to)),
    end: boundaryPoint(to, rectCenter(from)),
  };
}
