import type { Metadata } from "next";
import { Board } from "@/features/board/components/Board";
import { DEMO_NOTES } from "@/features/board/demo-notes";

export const metadata: Metadata = {
  title: "Demo board · Collab Board",
};

export default function BoardPage() {
  return <Board initialNotes={DEMO_NOTES} />;
}
