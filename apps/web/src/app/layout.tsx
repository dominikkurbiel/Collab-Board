import type { Metadata } from "next";
import { APP_NAME } from "@collab-board/shared";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Real-time collaborative whiteboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
