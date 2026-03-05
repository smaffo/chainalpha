import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare(`DELETE FROM watchlist WHERE id = ?`).run(Number(id));
  return NextResponse.json({ ok: true });
}
