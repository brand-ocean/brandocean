import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import { ResendOTP } from "./ResendOTP";

function adminEmails(): string[] {
	return (process.env.ADMIN_EMAILS ?? "")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

function assertAllowed(email: string | undefined) {
	const list = adminEmails();
	if (list.length === 0) return;
	if (!email || !list.includes(email.toLowerCase())) {
		throw new Error("not_allowed");
	}
}

const GatedPassword = Password({
	profile(params) {
		const email = params.email as string | undefined;
		assertAllowed(email);
		return { email: email as string };
	},
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [GatedPassword, ResendOTP, GitHub, Google],
	callbacks: {
		async createOrUpdateUser(rawCtx, args) {
			const ctx: MutationCtx = rawCtx as MutationCtx;
			const profile = args.profile as { email?: string };
			const email =
				typeof profile.email === "string" ? profile.email : undefined;
			const normalized = email?.trim().toLowerCase();

			// A provisioned feedback client (see convex/feedback.ts linkClient)
			// is allowed to log in even when not in the admin whitelist.
			const access = normalized
				? await ctx.db
						.query("feedbackAccess")
						.withIndex("by_email", (q) => q.eq("email", normalized))
						.first()
				: null;

			if (!access) {
				assertAllowed(email);
			}

			if (args.existingUserId) {
				if (access && !access.userId) {
					await ctx.db.patch(access._id, { userId: args.existingUserId });
				}
				return args.existingUserId;
			}

			const userId = await ctx.db.insert("users", args.profile);
			if (access && !access.userId) {
				await ctx.db.patch(access._id, { userId });
			}
			return userId;
		},
	},
});
