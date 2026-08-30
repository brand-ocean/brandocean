import { createFileRoute } from "@tanstack/react-router";
import { convexHttp } from "@/lib/convex-http";
import Intake from "@/site/components/Intake/Intake";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_site/start")({
	component: Intake,
	head: () => ({
		meta: [
			{ title: "Vertel eens — Brandocean" },
			{
				name: "description",
				content:
					"Een paar vragen over wat je wilt maken, en een eerste richting terug.",
			},
		],
	}),
	server: {
		handlers: {
			// De browser kent zijn eigen IP niet en mag het ook niet opgeven, dus de
			// start loopt hierlangs. Cloudflare zet het echte adres in
			// CF-Connecting-IP; Convex hasht het en bewaart alleen die hash.
			POST: async ({ request }) => {
				let body: { name?: string; email?: string; company?: string } = {};
				try {
					body = await request.json();
				} catch {
					return Response.json({ error: "bad_request" }, { status: 400 });
				}

				const ip =
					request.headers.get("CF-Connecting-IP") ??
					request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
					undefined;

				try {
					const { token } = await convexHttp.mutation(api.intakes.start, {
						name: body.name?.slice(0, 120),
						email: body.email?.slice(0, 200),
						company: body.company?.slice(0, 200),
						ip,
					});
					return Response.json({ token });
				} catch (error) {
					const message = error instanceof Error ? error.message : "";
					if (message.includes("rate_limited")) {
						return Response.json({ error: "rate_limited" }, { status: 429 });
					}
					return Response.json({ error: "server_error" }, { status: 500 });
				}
			},
		},
	},
});
