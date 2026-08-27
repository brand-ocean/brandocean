import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Brandmark, Logotype } from "@/components/brand";
import { DownloadPdfButton } from "@/components/nda/DownloadPdfButton";
import { OfferteStaticContent } from "@/components/offertes/OfferteStaticContent";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convexHttp } from "@/lib/convex-http";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/n/$slug")({
	validateSearch: (search: Record<string, unknown>) => ({
		t: typeof search.t === "string" ? search.t : undefined,
	}),
	loaderDeps: ({ search }) => ({ token: search.t }),
	loader: async ({ params, deps }) =>
		convexHttp.query(api.ndas.getBySlug, {
			slug: params.slug,
			token: deps.token,
		}),
	head: ({ loaderData }) => {
		const title = loaderData?.title;
		const fullTitle = title ? `${title} — BRANDOCEAN` : "NDA — BRANDOCEAN";
		return {
			meta: [
				{ title: fullTitle },
				{ name: "robots", content: "noindex, nofollow" },
			],
		};
	},
	component: PublicNda,
});

type Lang = "nl" | "en";

const COPY = {
	nl: {
		unavailableTitle: "Deze NDA is niet beschikbaar",
		unavailableBody:
			"De NDA is nog niet gepubliceerd, of je link mist de toegangstoken. Vraag de afzender om de meest recente link.",
		signedBanner: "Deze NDA is al ondertekend.",
		viewSigned: "Bekijk de ondertekende versie",
		readonlyNote:
			"Om te ondertekenen heb je de persoonlijke link met token nodig die je is toegestuurd.",
		formTitle: "Onderteken deze NDA",
		formIntro:
			"Vul je gegevens in en bevestig dat je akkoord gaat met de bovenstaande overeenkomst.",
		name: "Volledige naam",
		email: "E-mailadres",
		company: "Bedrijf (optioneel)",
		agree:
			"Ik heb deze geheimhoudingsovereenkomst gelezen en ga ermee akkoord.",
		submit: "Onderteken NDA",
		submitting: "Bezig met ondertekenen…",
		nameRequired: "Vul je volledige naam in.",
		agreeRequired: "Vink het vakje aan om akkoord te gaan.",
		success: "NDA ondertekend — bedankt!",
		error: "Ondertekenen mislukt",
	},
	en: {
		unavailableTitle: "This NDA isn't available",
		unavailableBody:
			"It hasn't been published yet, or your link is missing its access token. Ask the sender for the latest link.",
		signedBanner: "This NDA has already been signed.",
		viewSigned: "View the signed copy",
		readonlyNote:
			"To sign, use the personal link with a token that was sent to you.",
		formTitle: "Sign this NDA",
		formIntro:
			"Fill in your details and confirm that you agree to the agreement above.",
		name: "Full name",
		email: "Email address",
		company: "Company (optional)",
		agree: "I have read and agree to this non-disclosure agreement.",
		submit: "Sign NDA",
		submitting: "Signing…",
		nameRequired: "Please enter your full name.",
		agreeRequired: "Tick the box to agree.",
		success: "NDA signed — thank you!",
		error: "Could not sign",
	},
} as const;

function PublicNda() {
	const data = Route.useLoaderData();
	const { t: token } = Route.useSearch();
	const { slug } = Route.useParams();
	const navigate = useNavigate();

	const lang: Lang = data?.language === "en" ? "en" : "nl";
	const c = COPY[lang];

	if (data === null) {
		return (
			<Shell>
				<h1 className="text-2xl font-semibold">{COPY.en.unavailableTitle}</h1>
				<p className="max-w-md text-sm text-slate-500">
					{COPY.en.unavailableBody}
				</p>
			</Shell>
		);
	}

	const body = data.body as JSONContent | null;
	const hasBody =
		body && Array.isArray(body.content) && body.content.length > 0;

	return (
		<div className="force-theme-light min-h-screen bg-white text-slate-900">
			<header className="border-b border-slate-200">
				<div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-5">
					<Brandmark size={32} color="#0f172a" />
					<Logotype height={20} color="#0f172a" />
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-6 py-16">
				<h1 className="sr-only">{data.title}</h1>

				<div className="mb-6 flex justify-end">
					<DownloadPdfButton content={body} filename={data.title} />
				</div>

				{data.alreadySigned ? (
					<div className="no-print mb-10 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
						<p className="font-medium">{c.signedBanner}</p>
						{data.signedSlug ? (
							<a
								href={`/ns/${data.signedSlug}`}
								className="mt-1 inline-block font-medium underline"
							>
								{c.viewSigned}
							</a>
						) : null}
					</div>
				) : null}

				{hasBody && body ? (
					<section className="nda-doc">
						<OfferteStaticContent content={body} />
					</section>
				) : null}

				{!data.alreadySigned && data.canSign ? (
					<SignForm
						lang={lang}
						slug={slug}
						token={token ?? ""}
						onSigned={(signedSlug) => {
							toast.success(c.success);
							navigate({ to: "/ns/$slug", params: { slug: signedSlug } });
						}}
					/>
				) : null}

				{!data.alreadySigned &&
				!data.canSign &&
				data.direction === "client_signs" ? (
					<p className="no-print mt-10 rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
						{c.readonlyNote}
					</p>
				) : null}
			</main>
		</div>
	);
}

function SignForm({
	lang,
	slug,
	token,
	onSigned,
}: {
	lang: Lang;
	slug: string;
	token: string;
	onSigned: (signedSlug: string) => void;
}) {
	const c = COPY[lang];
	const nameId = useId();
	const emailId = useId();
	const companyId = useId();
	const agreeId = useId();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [company, setCompany] = useState("");
	const [agreed, setAgreed] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	return (
		<form
			className="mt-12 space-y-5 rounded-xl border border-slate-200 bg-slate-50/60 p-6"
			onSubmit={async (e) => {
				e.preventDefault();
				if (!name.trim()) {
					toast.error(c.nameRequired);
					return;
				}
				if (!agreed) {
					toast.error(c.agreeRequired);
					return;
				}
				setSubmitting(true);
				try {
					const result = await convexHttp.mutation(api.signedNdas.signNda, {
						slug,
						token,
						signedByName: name.trim(),
						signedByEmail: email.trim() || undefined,
						signedByCompany: company.trim() || undefined,
						userAgent:
							typeof navigator !== "undefined"
								? navigator.userAgent
								: undefined,
					});
					onSigned(result.slug);
				} catch (err) {
					toast.error(c.error, {
						description: err instanceof Error ? err.message : String(err),
					});
					setSubmitting(false);
				}
			}}
		>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{c.formTitle}</h2>
				<p className="text-sm text-slate-500">{c.formIntro}</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5 sm:col-span-2">
					<Label htmlFor={nameId}>{c.name}</Label>
					<Input
						id={nameId}
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoComplete="name"
						required
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor={emailId}>{c.email}</Label>
					<Input
						id={emailId}
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor={companyId}>{c.company}</Label>
					<Input
						id={companyId}
						value={company}
						onChange={(e) => setCompany(e.target.value)}
						autoComplete="organization"
					/>
				</div>
			</div>

			<div className="flex items-start gap-3 text-sm">
				<Checkbox
					id={agreeId}
					checked={agreed}
					onCheckedChange={(v) => setAgreed(v === true)}
					className="mt-0.5"
				/>
				<Label htmlFor={agreeId} className="font-normal leading-snug">
					{c.agree}
				</Label>
			</div>

			<Button type="submit" disabled={submitting} className="w-full sm:w-auto">
				{submitting ? c.submitting : c.submit}
			</Button>
		</form>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="force-theme-light flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center text-slate-900">
			<div className="flex items-center gap-3">
				<Brandmark size={48} color="#0f172a" />
				<Logotype height={32} color="#0f172a" />
			</div>
			{children}
		</div>
	);
}
