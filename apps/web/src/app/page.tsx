import Link from "next/link";
import { APP_NAME, DEMO_BOARD_ID } from "@collab-board/shared";
import { CreateBoardForm } from "@/features/sharing/CreateBoardForm";
import { ServerStatus } from "./server-status";

export default function HomePage() {
  return (
    <main className="home">
      <h1>{APP_NAME}</h1>
      <p>Real-time collaborative whiteboard. Work in progress.</p>
      <CreateBoardForm />
      <p>
        or <Link href={`/board/${DEMO_BOARD_ID}`}>try the public demo board →</Link>
      </p>
      <ServerStatus />
    </main>
  );
}
