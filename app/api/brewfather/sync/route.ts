import { NextResponse } from "next/server";
import {
  apiError,
  checkOrigin,
  consumeQuota,
  readJSON,
  requireUser,
} from "@/lib/api";
import {
  brewfatherCredentials,
  fetchBrewfatherInventory,
} from "@/lib/brewfather";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    const credentials = brewfatherCredentials.parse(
      await readJSON(request, 2048),
    );
    await consumeQuota(supabase, "sync");
    const inventory = await fetchBrewfatherInventory(credentials);
    const { error } = await supabase
      .from("inventories")
      .upsert({
        user_id: user.id,
        items: inventory,
        source: "brewfather",
        synced_at: new Date().toISOString(),
      });
    if (error) throw error;
    return NextResponse.json({ inventory });
  } catch (error) {
    return apiError(error);
  }
}
