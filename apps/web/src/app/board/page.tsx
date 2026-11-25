import type { Metadata } from "next";
import { Board } from "@/features/board/components/Board";
import { DEMO_BOARD } from "@/features/board/demo-board";

export const metadata: Metadata = {
  title: "Demo board · Collab Board",
};

export default function BoardPage() {
  return <Board initialDocument={DEMO_BOARD} />;
}
