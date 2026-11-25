/**
 * Pure math for the infinite canvas. Two coordinate systems:
 * - screen: pixels inside the board element (what the mouse reports)
 * - world:  position on the infinite board (what we store)
 *
 *   screen = world * zoom + offset
 *   world  = (screen - offset) / zoom
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

/** `x` / `y` = where the world origin (0, 0) currently is on the screen. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const INITIAL_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(viewport: Viewport, point: Point): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

export function worldToScreen(viewport: Viewport, point: Point): Point {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}

/**
 * Zooms so that the world point under `screenPoint` stays under it
 * (zooming "towards the cursor").
 */
export function zoomAt(viewport: Viewport, screenPoint: Point, factor: number): Viewport {
  const zoom = clampZoom(viewport.zoom * factor);
  const anchor = screenToWorld(viewport, screenPoint);
  return {
    zoom,
    x: screenPoint.x - anchor.x * zoom,
    y: screenPoint.y - anchor.y * zoom,
  };
}

/** Rectangle spanned by two corner points, in any order (e.g. dragging up-left). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function centeredRect(center: Point, size: Size): Rect {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

/** Smallest rectangle containing all given rectangles, or null when there are none. */
export function getBounds(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Viewport that shows all rectangles centered on screen (never zooms in past 100%). */
export function fitToContent(rects: readonly Rect[], screen: Size, padding = 80): Viewport {
  const bounds = getBounds(rects);
  if (!bounds) return INITIAL_VIEWPORT;

  const availableWidth = Math.max(1, screen.width - padding * 2);
  const availableHeight = Math.max(1, screen.height - padding * 2);
  const zoom = clampZoom(
    Math.min(1, availableWidth / bounds.width, availableHeight / bounds.height),
  );

  return {
    zoom,
    x: screen.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: screen.height / 2 - (bounds.y + bounds.height / 2) * zoom,
  };
}
