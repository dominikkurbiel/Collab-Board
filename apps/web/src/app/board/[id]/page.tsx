import { isValidBoardId } from "@collab-board/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardGate } from "@/features/sharing/BoardGate";

interface BoardPageProps {
  // In Next.js 15+ route params are a Promise
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BoardPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Board ${id} · Collab Board` };
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;
  if (!isValidBoardId(id)) notFound();

  // Everyone who opens this URL joins the same live board (after the access check)
  return <BoardGate boardId={id} />;
}
