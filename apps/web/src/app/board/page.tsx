import type { Metadata } from "next";
import { Board } from "@/features/board/components/Board";
import { DEMO_ELEMENTS } from "@/features/board/demo-elements";

export const metadata: Metadata = {
  title: "Demo board · Collab Board",
};

export default function BoardPage() {
  return <Board initialElements={DEMO_ELEMENTS} />;
}
