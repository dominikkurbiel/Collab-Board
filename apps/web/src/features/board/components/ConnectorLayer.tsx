"use client";

import type { BoardConnector, BoardElement } from "@collab-board/shared";
import { useId } from "react";
import styles from "../board.module.css";
import { boundaryPoint, connectorEndpoints } from "../geometry";
import type { Point } from "../viewport";

/** An arrow being drawn: starts at an element, ends at the cursor (or snaps to a target). */
export interface ConnectorDraft {
  from: BoardElement;
  end: Point;
}

interface ConnectorLayerProps {
  elements: readonly BoardElement[];
  connectors: readonly BoardConnector[];
  selectedId: string | null;
  draft: ConnectorDraft | null;
  onSelect: (id: string) => void;
}

/**
 * All arrows, drawn as one SVG inside the zoomed world (so they pan and zoom with the
 * elements). It sits below the elements, so arrowheads tuck neatly under their edges.
 */
export function ConnectorLayer({
  elements,
  connectors,
  selectedId,
  draft,
  onSelect,
}: ConnectorLayerProps) {
  // Marker ids must be unique in the whole HTML document
  const markerId = useId();
  const arrowhead = `${markerId}-arrow`;
  const selectedArrowhead = `${markerId}-arrow-selected`;

  const byId = new Map(elements.map((el) => [el.id, el]));

  return (
    <svg className={styles.connectors} aria-hidden>
      <defs>
        <Arrowhead id={arrowhead} className={styles.arrowhead} />
        <Arrowhead id={selectedArrowhead} className={styles.arrowheadSelected} />
      </defs>

      {connectors.map((connector) => {
        const from = byId.get(connector.from);
        const to = byId.get(connector.to);
        if (!from || !to) return null; // e.g. the other end was just deleted by someone else

        const { start, end } = connectorEndpoints(from, to);
        const isSelected = connector.id === selectedId;
        const d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

        return (
          <g key={connector.id}>
            {/* Wide invisible stroke: a 2px line would be very hard to click */}
            <path
              className={styles.connectorHitArea}
              d={d}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation(); // don't start panning or deselect
                onSelect(connector.id);
              }}
            />
            <path
              className={`${styles.connector} ${isSelected ? styles.connectorSelected : ""}`}
              d={d}
              markerEnd={`url(#${isSelected ? selectedArrowhead : arrowhead})`}
            />
          </g>
        );
      })}

      {draft && <DraftConnector draft={draft} markerId={selectedArrowhead} />}
    </svg>
  );
}

function DraftConnector({ draft, markerId }: { draft: ConnectorDraft; markerId: string }) {
  const start = boundaryPoint(draft.from, draft.end);
  return (
    <path
      className={`${styles.connector} ${styles.connectorDraft}`}
      d={`M ${start.x} ${start.y} L ${draft.end.x} ${draft.end.y}`}
      markerEnd={`url(#${markerId})`}
    />
  );
}

function Arrowhead({ id, className }: { id: string; className?: string }) {
  return (
    // Sized relative to the line width; orient="auto" rotates it along the line
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto"
    >
      <path className={className} d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
  );
}
