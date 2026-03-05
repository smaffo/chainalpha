import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: thesis, error } = await supabase
    .from("theses")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (error || !thesis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(thesis);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await supabase.from("theses").delete().eq("id", Number(id));
  return NextResponse.json({ ok: true });
}
