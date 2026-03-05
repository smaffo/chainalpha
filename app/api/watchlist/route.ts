import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(`SELECT id, title, thesis_text, catalyst, added_at FROM watchlist ORDER BY added_at DESC`)
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { title, thesis_text, catalyst } = await req.json();
  if (!thesis_text) {
    return NextResponse.json({ error: "thesis_text required" }, { status: 400 });
  }
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM watchlist WHERE thesis_text = ?`)
    .get(thesis_text) as { id: number } | undefined;
  if (existing) {
    return NextResponse.json({ duplicate: true, id: existing.id });
  }
  const result = db
    .prepare(`INSERT INTO watchlist (title, thesis_text, catalyst) VALUES (?, ?, ?)`)
    .run(title ?? "", thesis_text, catalyst ?? "");
  return NextResponse.json({ id: result.lastInsertRowid });
}
