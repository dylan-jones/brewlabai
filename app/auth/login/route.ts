import { signInWithGoogle } from "../actions";
import { isAuthConfigured } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!isAuthConfigured())
    return NextResponse.redirect(
      new URL("/auth/error?reason=configuration", request.url),
    );
  return signInWithGoogle();
}
