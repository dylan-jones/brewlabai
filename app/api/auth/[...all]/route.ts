import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getAuth, isAuthConfigured } from "@/lib/auth";

async function handle(request: Request) {
  if (!isAuthConfigured())
    return NextResponse.json({ error: "Google authentication is not configured." }, { status: 503 });
  try {
    return await (await getAuth()).handler(request);
  } catch (error) {
    return apiError(error);
  }
}

export const GET = handle;
export const POST = handle;