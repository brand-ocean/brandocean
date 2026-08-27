import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { usePageTitle } from "@/components/app/page-title";
import { TonePill } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/specs/$specId")({
	component: SpecDetail,
});

function SpecDetail() {
	const { specId } = Route.useParams();
	const data = useQuery(api.specs.getById, { id: specId as Id<"specs"> });
	usePageTitle(data?.spec.title);

	if (data === undefined) {
		return (
			<Frame>
				<FramePanel>
					<p className="text-muted-foreground text-sm">Laden…</p>
				</FramePanel>
			</Frame>
		);
	}

	const { spec, questions } = data;
	const answered = questions.filter((q) => q.answer !== undefined).length;

	return (
		<div className="flex flex-col gap-4">
			<Frame>
				<FrameHeader>
					<FrameHeading>
						<FrameTitle>{spec.title}</FrameTitle>
						<FrameDescription>
							{questions.length === 0
								? "Nog geen vragen"
								: `${answered} van ${questions.length} beantwoord`}
						</FrameDescription>
					</FrameHeading>
					<FrameActions>
						<ShareBar spec={spec} />
					</FrameActions>
				</FrameHeader>
				<FramePanel>
					<IntroField spec={spec} />
				</FramePanel>
			</Frame>

			<div className="flex flex-col gap-3">
				{questions.map((question, index) => (
					<QuestionCard
						key={question._id}
						question={question}
						number={index + 1}
					/>
				))}
			</div>

			<AddQuestion specId={spec._id} />
		</div>
	);
}

// Publiceren en de link kopiëren. Zonder token is de pagina niet te openen,
// dus de link die je kopieert bevat hem altijd.
function ShareBar({ spec }: { spec: Doc<"specs"> }) {
	const setPublished = useMutation(api.specs.setPublished);
	const publishId = useId();
	const [copied, setCopied] = useState(false);

	const origin = typeof window === "undefined" ? "" : window.location.origin;
	const url = `${origin}/v/${spec.slug}?t=${spec.shareToken}`;

	async function copy() {
		await navigator.clipboard.writeText(url);
		setCopied(true);
		toast.success("Link gekopieerd");
		window.setTimeout(() => setCopied(false), 1500);
	}

	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-2">
				<Label htmlFor={publishId} className="text-xs">
					Gedeeld
				</Label>
				<Switch
					id={publishId}
					checked={spec.published}
					onCheckedChange={(next) =>
						void setPublished({ id: spec._id, published: next }).catch(
							(err: unknown) =>
								toast.error("Kon niet wijzigen", {
									description: err instanceof Error ? err.message : String(err),
								}),
						)
					}
				/>
			</div>
			<Button
				size="sm"
				variant="secondary"
				disabled={!spec.published}
				onClick={() => void copy()}
			>
				{copied ? (
					<CheckIcon data-icon="inline-start" />
				) : (
					<CopyIcon data-icon="inline-start" />
				)}
				Link kopiëren
			</Button>
		</div>
	);
}

// Korte inleiding boven de vragen op de publieke pagina. Slaat op zodra het
// veld de focus verliest, zodat er geen losse opslaanknop nodig is.
function IntroField({ spec }: { spec: Doc<"specs"> }) {
	const update = useMutation(api.specs.update);
	const introId = useId();
	const [intro, setIntro] = useState(spec.intro ?? "");

	return (
		<Field>
			<FieldLabel htmlFor={introId}>Inleiding</FieldLabel>
			<Textarea
				id={introId}
				value={intro}
				rows={2}
				placeholder="Eén of twee zinnen die de klant leest voordat hij begint."
				onChange={(e) => setIntro(e.target.value)}
				onBlur={() => {
					if (intro === (spec.intro ?? "")) return;
					void update({ id: spec._id, intro }).catch((err: unknown) =>
						toast.error("Opslaan mislukt", {
							description: err instanceof Error ? err.message : String(err),
						}),
					);
				}}
			/>
		</Field>
	);
}

// Eén vraag. De velden slaan op bij blur; het antwoord van de klant staat
// eronder en is hier bewust niet te bewerken.
function QuestionCard({
	question,
	number,
}: {
	question: Doc<"specQuestions">;
	number: number;
}) {
	const update = useMutation(api.specs.updateQuestion);
	const remove = useMutation(api.specs.removeQuestion);
	const [text, setText] = useState(question.question);
	const [detail, setDetail] = useState(question.detail ?? "");
	const [fallback, setFallback] = useState(question.fallback ?? "");
	const [note, setNote] = useState(question.note ?? "");

	function save(patch: Parameters<typeof update>[0]) {
		void update(patch).catch((err: unknown) =>
			toast.error("Opslaan mislukt", {
				description: err instanceof Error ? err.message : String(err),
			}),
		);
	}

	return (
		<Frame>
			<FramePanel className="flex flex-col gap-3">
				<div className="flex items-start gap-3">
					<span className="mt-2 w-6 shrink-0 font-medium text-muted-foreground text-sm tabular-nums">
						{String(number).padStart(2, "0")}
					</span>
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Input
							value={text}
							placeholder="De vraag"
							className="font-medium"
							onChange={(e) => setText(e.target.value)}
							onBlur={() => {
								if (text.trim() === question.question) return;
								save({ id: question._id, question: text });
							}}
						/>
						<Textarea
							value={detail}
							rows={2}
							placeholder="Toelichting (optioneel)"
							onChange={(e) => setDetail(e.target.value)}
							onBlur={() => {
								if (detail.trim() === (question.detail ?? "")) return;
								save({ id: question._id, detail });
							}}
						/>
						<Input
							value={fallback}
							placeholder="Wat ik doe als er geen antwoord komt (optioneel)"
							onChange={(e) => setFallback(e.target.value)}
							onBlur={() => {
								if (fallback.trim() === (question.fallback ?? "")) return;
								save({ id: question._id, fallback });
							}}
						/>
						<Textarea
							value={note}
							rows={2}
							placeholder="Wat wij ermee hebben gedaan (staat op de publieke pagina)"
							onChange={(e) => setNote(e.target.value)}
							onBlur={() => {
								if (note.trim() === (question.note ?? "")) return;
								save({ id: question._id, note });
							}}
						/>
					</div>
					<div className="flex shrink-0 items-center gap-3">
						<div className="flex items-center gap-2">
							<Label
								htmlFor={`blocking-${question._id}`}
								className="text-muted-foreground text-xs"
							>
								Blokkeert
							</Label>
							<Switch
								id={`blocking-${question._id}`}
								checked={question.blocking}
								onCheckedChange={(next) =>
									save({ id: question._id, blocking: next })
								}
							/>
						</div>
						<Button
							size="icon"
							variant="ghost"
							aria-label="Vraag verwijderen"
							onClick={() => void remove({ id: question._id })}
						>
							<Trash2Icon />
						</Button>
					</div>
				</div>

				{question.answer !== undefined ? (
					<>
						<Separator />
						<div className="flex flex-col gap-1.5 pl-9">
							<div className="flex items-center gap-2">
								<TonePill tone={question.resolved ? "success" : "info"}>
									{question.resolved ? "Afgehandeld" : "Antwoord"}
								</TonePill>
								<span className="text-muted-foreground text-xs">
									{question.answeredBy ? `${question.answeredBy}, ` : ""}
									{question.answeredAt
										? new Date(question.answeredAt).toLocaleDateString("nl-NL")
										: ""}
								</span>
								<Button
									size="sm"
									variant="ghost"
									className="ml-auto"
									onClick={() =>
										save({ id: question._id, resolved: !question.resolved })
									}
								>
									{question.resolved ? "Heropen" : "Markeer afgehandeld"}
								</Button>
							</div>
							<p className="whitespace-pre-wrap text-sm">{question.answer}</p>
						</div>
					</>
				) : null}
			</FramePanel>
		</Frame>
	);
}

function AddQuestion({ specId }: { specId: Id<"specs"> }) {
	const add = useMutation(api.specs.addQuestion);
	const questionId = useId();
	const detailId = useId();
	const fallbackId = useId();
	const blockingId = useId();
	const [question, setQuestion] = useState("");
	const [detail, setDetail] = useState("");
	const [fallback, setFallback] = useState("");
	const [blocking, setBlocking] = useState(false);
	const [saving, setSaving] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		if (!question.trim()) return;
		setSaving(true);
		try {
			await add({ specId, question, detail, fallback, blocking });
			setQuestion("");
			setDetail("");
			setFallback("");
			setBlocking(false);
		} catch (err) {
			toast.error("Toevoegen mislukt", {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Vraag toevoegen</FrameTitle>
				</FrameHeading>
			</FrameHeader>
			<FramePanel>
				<form onSubmit={submit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={questionId}>Vraag</FieldLabel>
							<Input
								id={questionId}
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								placeholder="Wat is de commissieregel bij Werving en Selectie?"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={detailId}>Toelichting</FieldLabel>
							<Textarea
								id={detailId}
								value={detail}
								rows={2}
								onChange={(e) => setDetail(e.target.value)}
								placeholder="Waarom je het vraagt, of waar je zelf tegenaan loopt."
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={fallbackId}>
								Zonder antwoord doe ik
							</FieldLabel>
							<Input
								id={fallbackId}
								value={fallback}
								onChange={(e) => setFallback(e.target.value)}
								placeholder="Laat leeg als je echt niet verder kunt zonder antwoord."
							/>
						</Field>
					</FieldGroup>
					<div className="mt-4 flex items-center gap-3">
						<div className="flex items-center gap-2">
							<Label htmlFor={blockingId} className="text-xs">
								Blokkeert
							</Label>
							<Switch
								id={blockingId}
								checked={blocking}
								onCheckedChange={setBlocking}
							/>
						</div>
						<Button
							type="submit"
							size="sm"
							className="ml-auto"
							disabled={saving || !question.trim()}
						>
							<PlusIcon data-icon="inline-start" />
							Toevoegen
						</Button>
					</div>
				</form>
			</FramePanel>
		</Frame>
	);
}
