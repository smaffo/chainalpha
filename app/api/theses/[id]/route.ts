import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const thesis = db.prepare("SELECT * FROM theses WHERE id = ?").get(id) as
    | {
        id: number;
        thesis_text: string;
        title: string;
        created_at: string;
        last_mapped_at: string;
      }
    | undefined;

  if (!thesis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(thesis);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM theses WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
