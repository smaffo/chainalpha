import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: rows, error } = await supabase
    .from("watchlist")
    .select("id, title, thesis_text, catalyst, added_at")
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(rows ?? []);
}

export async function POST(req: NextRequest) {
  const { title, thesis_text, catalyst } = await req.json();
  if (!thesis_text) {
    return NextResponse.json({ error: "thesis_text required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("thesis_text", thesis_text)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ duplicate: true, id: existing.id });
  }

  const { data: inserted, error } = await supabase
    .from("watchlist")
    .insert({ title: title ?? "", thesis_text, catalyst: catalyst ?? "" })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }
  return NextResponse.json({ id: inserted.id });
}
