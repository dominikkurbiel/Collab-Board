import Link from "next/link";
import { APP_NAME, DEMO_BOARD_ID } from "@collab-board/shared";
import { ServerStatus } from "./server-status";

export default function HomePage() {
  return (
    <main className="home">
      <h1>{APP_NAME}</h1>
      <p>Real-time collaborative whiteboard. Work in progress.</p>
      <p>
        <Link href={`/board/${DEMO_BOARD_ID}`}>Open demo board →</Link>
      </p>
      <ServerStatus />
    </main>
  );
}
