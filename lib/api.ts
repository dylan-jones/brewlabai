import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient, isSupabaseConfigured } from "./supabase/server";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function requireUser() {
  if (!isSupabaseConfigured())
    throw new ApiError(
      "Supabase is not configured. Add the environment variables and enable Google sign-in.",
      503,
    );
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    throw new ApiError(
      "Sign in with Google to use your connected brewing workspace.",
      401,
    );
  return { supabase, user };
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new ApiError(
      "This action must originate from this application.",
      403,
    );
}

export async function readJSON(
  request: Request,
  limit = 64000,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError("Expected JSON content.", 415);
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new ApiError("Request is too large.", 413);
  if (!request.body) throw new ApiError("Request body is missing.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError("Request is too large.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Invalid JSON.");
  } finally {
    reader.releaseLock();
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error:
          "Invalid input. Check ingredient quantities and required fields.",
        details: error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  return NextResponse.json(
    {
      error:
        "The connected service could not complete this request. Check your configuration and try again.",
    },
    { status: 502 },
  );
}

export async function consumeQuota(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: "ai" | "sync",
) {
  const { data, error } = await supabase.rpc("consume_api_quota", {
    action_name: action,
  });
  if (error)
    throw new ApiError(
      "Apply the Supabase migration before using connected services.",
      503,
    );
  if (!data)
    throw new ApiError(
      "Hourly usage limit reached. Please try again later.",
      429,
    );
}
