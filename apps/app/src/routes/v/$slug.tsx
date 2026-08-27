import { createFileRoute } from "@tanstack/react-router";
import { ConvexProvider, useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import { useState } from "react";
import { Brandmark, Logotype } from "@/components/brand";
import { getConvexClient } from "@/lib/convex";
import { convexHttp } from "@/lib/convex-http";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

// Publieke vragenlijst. De token in de link is de sleutel: zonder token geen
// pagina en geen antwoord. Bewust los van de app-shell, in het lichte thema,
// zodat het leest als een stuk van BRANDOCEAN en niet als een dashboard.
export const Route = createFileRoute("/v/$slug")({
	validateSearch: (search: Record<string, unknown>) => ({
		t: typeof search.t === "string" ? search.t : undefined,
	}),
	loaderDeps: ({ search }) => ({ token: search.t }),
	loader: async ({ params, deps }) =>
		convexHttp.query(api.specs.getBySlug, {
			slug: params.slug,
			token: deps.token,
		}),
	head: ({ loaderData }) => {
		const title = loaderData?.title;
		const pageTitle = title
			? `${title} — vragen van BRANDOCEAN`
			: "Vragen van BRANDOCEAN";
		return {
			meta: [
				{ title: pageTitle },
				{ name: "robots", content: "noindex, nofollow" },
			],
		};
	},
	component: PublicSpecRoute,
});

// Deze route hangt in de root, buiten _authed en _marketing — en dat zijn de
// enige twee plekken waar een Convex-provider gemount wordt. De loader werkt
// daardoor wel (die gaat over HTTP), maar de live useQuery/useMutation hieronder
// hebben een client in de tree nodig. Vandaar een eigen provider om alleen deze
// pagina heen; de andere publieke routes gebruiken puur convexHttp en hebben
// hem niet nodig.
function PublicSpecRoute() {
	return (
		<ConvexProvider client={getConvexClient()}>
			<PublicSpec />
		</ConvexProvider>
	);
}

// Dezelfde pagina draagt twee soorten lijsten, en het enige verschil is de
// woordkeus. Bij een vragenlijst is een vinkje "rond", bij een statuslijst is
// het "af", en dan is het invulveld geen antwoord meer maar een opmerking.
const COPY = {
	vragen: {
		blockingTitle: "Hier wacht ik op",
		restTitle: "De rest",
		restTitleAlone: "Vragen",
		doneTitle: "Rond",
		doneBlurb:
			"Deze zijn duidelijk, hier hoef je niets meer mee. Ze staan er alleen nog om terug te kunnen lezen wat we hebben afgesproken.",
		doneCount: "rond",
		placeholder: "Je antwoord",
		noteLabel: "Wat ik ermee heb gedaan",
		footer:
			"Je antwoorden worden meteen opgeslagen. Je kunt ze later aanpassen via dezelfde link.",
	},
	status: {
		blockingTitle: "Hier wacht ik op jou",
		restTitle: "Nog open",
		restTitleAlone: "Nog open",
		doneTitle: "Af",
		doneBlurb:
			"Hier hoef je niets meer mee. Bij elk punt staat wat ermee gebeurd is, zodat je kunt teruglezen wat we hebben afgesproken en wat er gebouwd is.",
		// "onderwerpen" en niet "af", want een statuslijst bundelt punten per
		// onderwerp. Zonder dat woord botst deze teller met het totaal dat in de
		// inleiding staat.
		doneCount: "onderwerpen af",
		placeholder: "Antwoord of opmerking",
		noteLabel: "Stand van zaken",
		footer:
			"Je opmerkingen worden meteen opgeslagen. Je kunt ze later aanpassen via dezelfde link.",
	},
} as const;

type Copy = (typeof COPY)[keyof typeof COPY];

function PublicSpec() {
	const { slug } = Route.useParams();
	const { t: token } = Route.useSearch();
	const initial = Route.useLoaderData();
	const live = useQuery(api.specs.getBySlug, { slug, token });
	const data = live ?? initial;
	const [name, setName] = useState("");

	if (data === null) {
		return (
			<div className="force-theme-light flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center text-slate-900">
				<div className="flex items-center gap-3">
					<Brandmark size={48} color="#0f172a" />
					<Logotype height={32} color="#0f172a" />
				</div>
				<h1 className="font-semibold text-2xl">
					Deze pagina is niet beschikbaar
				</h1>
				<p className="max-w-md text-slate-500 text-sm">
					De lijst is nog niet gedeeld, of je link mist zijn toegangssleutel.
					Vraag de afzender om de laatste link.
				</p>
			</div>
		);
	}

	// Afgevinkte vragen zakken naar onderen. Wat overblijft is precies de lijst
	// waar nog iets van jou nodig is, en dat is waar de pagina op moet openen.
	const open = data.questions.filter((q) => !q.resolved);
	const blocking = open.filter((q) => q.blocking);
	const rest = open.filter((q) => !q.blocking);
	const done = data.questions.filter((q) => q.resolved);
	const copy = COPY[data.kind];

	return (
		<div className="force-theme-light min-h-screen bg-white text-slate-900">
			<header className="border-slate-200 border-b">
				<div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-5">
					<Brandmark size={32} color="#0f172a" />
					<Logotype height={20} color="#0f172a" />
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-14">
				<h1 className="font-semibold text-3xl tracking-tight">{data.title}</h1>
				{data.intro ? (
					<p className="mt-3 max-w-2xl whitespace-pre-wrap text-base text-slate-600">
						{data.intro}
					</p>
				) : null}

				<div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-slate-200 border-t pt-5 text-slate-500 text-sm">
					<span className="tabular-nums">
						{done.length} van {data.questions.length} {copy.doneCount}
					</span>
					{open.length > 0 ? (
						<span className="tabular-nums">{open.length} nog open</span>
					) : null}
					<label className="flex items-center gap-2">
						<span>Je naam</span>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Ben"
							className="w-36 rounded-md border border-slate-300 px-2.5 py-1 text-slate-900 text-sm outline-none focus-visible:border-slate-900"
						/>
					</label>
				</div>

				{blocking.length > 0 ? (
					<section className="mt-12">
						<h2 className="font-medium text-slate-900 text-sm uppercase tracking-widest">
							{copy.blockingTitle}
						</h2>
						<div className="mt-4 flex flex-col gap-3">
							{blocking.map((question, index) => (
								<QuestionBlock
									key={question._id}
									question={question}
									number={index + 1}
									token={token}
									name={name}
									copy={copy}
								/>
							))}
						</div>
					</section>
				) : null}

				{rest.length > 0 ? (
					<section className="mt-12">
						<h2 className="font-medium text-slate-900 text-sm uppercase tracking-widest">
							{blocking.length > 0 ? copy.restTitle : copy.restTitleAlone}
						</h2>
						<div className="mt-4 flex flex-col gap-3">
							{rest.map((question, index) => (
								<QuestionBlock
									key={question._id}
									question={question}
									number={blocking.length + index + 1}
									token={token}
									name={name}
									copy={copy}
								/>
							))}
						</div>
					</section>
				) : null}

				{done.length > 0 ? (
					<section className="mt-12">
						<h2 className="font-medium text-slate-900 text-sm uppercase tracking-widest">
							{copy.doneTitle}
						</h2>
						<p className="mt-1.5 text-slate-500 text-sm">{copy.doneBlurb}</p>
						<div className="mt-4 flex flex-col gap-3">
							{done.map((question) => (
								<QuestionBlock
									key={question._id}
									question={question}
									number={0}
									token={token}
									name={name}
									copy={copy}
								/>
							))}
						</div>
					</section>
				) : null}

				<p className="mt-14 border-slate-200 border-t pt-6 text-slate-500 text-sm">
					{copy.footer}
				</p>
			</main>
		</div>
	);
}

type PublicQuestion = {
	_id: Id<"specQuestions">;
	question: string;
	detail?: string;
	fallback?: string;
	blocking: boolean;
	answer?: string;
	answeredBy?: string;
	answeredAt?: number;
	note?: string;
	resolved: boolean;
};

// Wat wij met het punt hebben gedaan. Staat los van het antwoord van de klant,
// zodat op één kaart te zien is wat hij zei én waar het is geland.
function Note({ note, label }: { note: string; label: string }) {
	return (
		<div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
			<p className="font-medium text-slate-500 text-xs uppercase tracking-widest">
				{label}
			</p>
			<p className="mt-1 whitespace-pre-wrap text-slate-700 text-sm">{note}</p>
		</div>
	);
}

function QuestionBlock({
	question,
	number,
	token,
	name,
	copy,
}: {
	question: PublicQuestion;
	number: number;
	token: string | undefined;
	name: string;
	copy: Copy;
}) {
	const answerQuestion = useMutation(api.specs.answerQuestion);
	const [draft, setDraft] = useState(question.answer ?? "");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const dirty = draft.trim() !== (question.answer ?? "").trim();

	async function save() {
		if (!token) return;
		setSaving(true);
		setError(null);
		try {
			await answerQuestion({
				questionId: question._id,
				token,
				answer: draft,
				name,
			});
			setSaved(true);
			window.setTimeout(() => setSaved(false), 2000);
		} catch (err) {
			setError(
				err instanceof Error
					? "Opslaan lukte niet. Probeer het nog een keer."
					: "Opslaan lukte niet.",
			);
		} finally {
			setSaving(false);
		}
	}

	// Afgevinkt: geen invoerveld meer, alleen terug te lezen. De vraag blijft
	// staan omdat het antwoord de afspraak is.
	if (question.resolved) {
		return (
			<article className="rounded-lg border border-slate-200 bg-slate-50/60">
				<div className="flex gap-4 p-5">
					<span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
						<Check className="size-4" aria-hidden="true" />
						<span className="sr-only">Rond</span>
					</span>
					<div className="min-w-0 flex-1">
						<h3 className="font-medium text-base text-slate-900">
							{question.question}
						</h3>
						{question.answer ? (
							<p className="mt-2 whitespace-pre-wrap text-slate-600 text-sm">
								{question.answer}
							</p>
						) : null}
						{question.note ? (
							<Note note={question.note} label={copy.noteLabel} />
						) : null}
					</div>
				</div>
			</article>
		);
	}

	return (
		<article className="rounded-lg border border-slate-200 bg-white">
			<div className="flex gap-4 p-5">
				<span
					className={`flex size-7 shrink-0 items-center justify-center rounded-md font-medium text-sm tabular-nums ${
						question.blocking
							? "bg-slate-900 text-white"
							: "bg-slate-100 text-slate-500"
					}`}
				>
					{number}
				</span>
				<div className="min-w-0 flex-1">
					<h3 className="font-medium text-base text-slate-900">
						{question.question}
					</h3>
					{question.detail ? (
						<p className="mt-1.5 whitespace-pre-wrap text-slate-600 text-sm">
							{question.detail}
						</p>
					) : null}
					{question.fallback ? (
						<p className="mt-2.5 border-slate-200 border-l-2 pl-3 text-slate-500 text-sm">
							<span className="font-medium text-slate-700">
								Zonder antwoord doe ik:{" "}
							</span>
							{question.fallback}
						</p>
					) : null}
					{question.note ? (
						<Note note={question.note} label={copy.noteLabel} />
					) : null}

					<textarea
						value={draft}
						rows={3}
						onChange={(e) => setDraft(e.target.value)}
						placeholder={copy.placeholder}
						className="mt-4 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-slate-900 text-sm outline-none placeholder:text-slate-400 focus-visible:border-slate-900"
					/>

					<div className="mt-2 flex flex-wrap items-center gap-3">
						<button
							type="button"
							disabled={saving || !dirty}
							onClick={() => void save()}
							className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-sm text-white disabled:opacity-40"
						>
							{saving ? "Bezig…" : "Opslaan"}
						</button>
						{saved ? (
							<span className="text-slate-500 text-sm">Opgeslagen</span>
						) : null}
						{!saved && question.answer !== undefined && !dirty ? (
							<span className="text-slate-500 text-sm">
								Beantwoord
								{question.answeredAt
									? ` op ${new Date(question.answeredAt).toLocaleDateString("nl-NL")}`
									: ""}
							</span>
						) : null}
						{error ? (
							<span className="text-red-600 text-sm">{error}</span>
						) : null}
					</div>
				</div>
			</div>
		</article>
	);
}
