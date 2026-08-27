import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function requireOwner(
	ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new ConvexError("unauthenticated");
	return userId;
}

export async function optionalOwner(
	ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
	return await getAuthUserId(ctx);
}
