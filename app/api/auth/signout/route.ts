import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { apiError, checkOrigin, requireUser } from "@/lib/api";
import { getAuth } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireUser();
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
