import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await supabase.from("watchlist").delete().eq("id", Number(id));
  return NextResponse.json({ ok: true });
}
