import { NextResponse } from "next/server";
import {
  apiError,
  checkOrigin,
  consumeQuota,
  requireUser,
} from "@/lib/api";
import {
  brewfatherCredentials,
  fetchBrewfatherInventory,
} from "@/lib/brewfather";
import { getBrewfatherConnection } from "@/lib/profile";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { workspace, user } = await requireUser();
    const credentials = brewfatherCredentials.parse(
      await getBrewfatherConnection(workspace, user.id),
    );
    await consumeQuota(workspace, "sync");
    const inventory = await fetchBrewfatherInventory(credentials);
    await workspace.saveInventory(inventory, "brewfather");
    return NextResponse.json({ inventory });
  } catch (error) {
    return apiError(error);
  }
}
