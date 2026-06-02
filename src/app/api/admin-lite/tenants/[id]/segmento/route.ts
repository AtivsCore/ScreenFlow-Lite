import { NextResponse } from "next/server";
import { assertMasterSession } from "@/lib/admin-auth";
import { SEGMENT_PRESET_MAP, type SegmentPresetId } from "@/lib/segment-presets";
import { createAdminClient } from "@/lib/supabase-admin";

type Body = { segmento_definido?: string };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await assertMasterSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const raw = typeof body.segmento_definido === "string" ? body.segmento_definido.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "segmento_definido é obrigatório" }, { status: 400 });
  }

  if (!(raw in SEGMENT_PRESET_MAP)) {
    return NextResponse.json({ error: "segmento inválido" }, { status: 400 });
  }

  const segmento_definido = raw as SegmentPresetId;
  const supabase = createAdminClient();
  const { error } = await supabase.from("tenants").update({ segmento_definido }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, segmento_definido }, { status: 200 });
}
