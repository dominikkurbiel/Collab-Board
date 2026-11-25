import Link from "next/link";
import { APP_NAME } from "@collab-board/shared";
import { ServerStatus } from "./server-status";

export default function HomePage() {
  return (
    <main className="home">
      <h1>{APP_NAME}</h1>
      <p>Real-time collaborative whiteboard. Work in progress.</p>
      <p>
        <Link href="/board">Open demo board →</Link>
      </p>
      <ServerStatus />
    </main>
  );
}
