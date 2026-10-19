import { NextResponse } from "next/server";
import { apiError, checkOrigin, readJSON, requireUser } from "@/lib/api";
import { getProfileSummary, updateProfile } from "@/lib/profile";

export async function GET() {
  try {
    const { workspace } = await requireUser();
    return NextResponse.json(await getProfileSummary(workspace));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const { workspace, user } = await requireUser();
    return NextResponse.json(await updateProfile(workspace, user.id, await readJSON(request, 12000)));
  } catch (error) {
    return apiError(error);
  }
}