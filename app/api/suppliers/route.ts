import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, checkOrigin, readJSON, requireUser } from "@/lib/api";
import { supplierSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireUser();
    const profile = supplierSchema.parse(await readJSON(request, 1500000));
    await workspace.saveSupplier(profile);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireUser();
    const id = z
      .string()
      .min(1)
      .max(160)
      .parse(new URL(request.url).searchParams.get("id"));
    await workspace.deleteSupplier(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
