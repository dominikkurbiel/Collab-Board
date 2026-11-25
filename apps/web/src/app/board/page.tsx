import { DEMO_BOARD_ID } from "@collab-board/shared";
import { redirect } from "next/navigation";

/** `/board` (the old demo URL) now points to the public demo board. */
export default function BoardIndexPage() {
  redirect(`/board/${DEMO_BOARD_ID}`);
}
