import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	ArrowRightIcon,
	ChevronDownIcon,
	HeadphonesIcon,
	MessagesSquareIcon,
	PlayIcon,
	RadioIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { type Column, DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { type Tone, TonePill } from "@/components/app/tone";
import { clock, formatDate, parseAgenda } from "@/components/coach/format";
import { recorder } from "@/components/coach/lib/recorder";
import { useRecorder } from "@/components/coach/parts";
import { openCoachWindow, pipSupported } from "@/components/coach/pip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/coach/")({
	component: CoachHome,
});

const NO_CLIENT = "__none__";
const CONTEXT_KEY = "coach.context";
const NAME_KEY = "coach.myName";

function stored(key: string, fallback: string): string {
	if (typeof window === "undefined") return fallback;
	try {
		return localStorage.getItem(key) ?? fallback;
	} catch {
		return fallback;
	}
}

function remember(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// privé-venster: dan niet onthouden
	}
}

type Row = {
	_id: Id<"coachSessions">;
	title: string;
	clientName: string | null;
	status: "live" | "finishing" | "done" | "error";
	startedAt: number;
	durationMs: number | null;
	reportPreview: string | null;
};

const STATUS: Record<Row["status"], { tone: Tone; label: string }> = {
	live: { tone: "info", label: "Open" },
	finishing: { tone: "warning", label: "Verslag…" },
	done: { tone: "success", label: "Klaar" },
	error: { tone: "danger", label: "Verslag mislukt" },
};

function CoachHome() {
	const sessions = useQuery(api.coach.sessions.list);
	const liveId = useRecorder((s) => (s.phase === "live" ? s.sessionId : null));

	const columns: readonly Column<Row>[] = [
		{
			id: "gesprek",
			header: "Gesprek",
			cell: (row) => (
				<div className="flex min-w-0 flex-col">
					<span className="truncate font-medium">{row.title}</span>
					<span className="text-muted-foreground truncate text-xs">
						{row.reportPreview ?? row.clientName ?? "—"}
					</span>
				</div>
			),
			sortValue: (row) => row.title,
		},
		{
			id: "klant",
			header: "Klant",
			cell: (row) => (
				<span className="text-muted-foreground">{row.clientName ?? "—"}</span>
			),
			sortValue: (row) => row.clientName ?? "",
		},
		{
			id: "duur",
			header: "Duur",
			align: "right",
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">
					{row.durationMs ? clock(row.durationMs) : "—"}
				</span>
			),
			sortValue: (row) => row.durationMs ?? 0,
		},
		{
			id: "status",
			header: "Status",
			cell: (row) => (
				<TonePill tone={STATUS[row.status].tone} dot>
					{STATUS[row.status].label}
				</TonePill>
			),
			sortValue: (row) => row.status,
		},
		{
			id: "datum",
			header: "Datum",
			align: "right",
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">
					{formatDate(row.startedAt)}
				</span>
			),
			sortValue: (row) => row.startedAt,
		},
	];

	return (
		<>
			{liveId ? (
				<Link
					to="/coach/$sessionId"
					params={{ sessionId: liveId }}
					className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm transition-colors hover:bg-emerald-500/15"
				>
					<span className="relative flex size-2.5">
						<span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
						<span className="relative size-2.5 rounded-full bg-emerald-500" />
					</span>
					<span className="font-medium">De coach luistert mee.</span>
					<span className="text-muted-foreground">Terug naar het gesprek</span>
					<ArrowRightIcon className="ml-auto size-4" />
				</Link>
			) : (
				<StartCard />
			)}

			<Frame>
				<FrameHeader>
					<FrameHeading>
						<FrameTitle>Eerdere gesprekken</FrameTitle>
						<FrameDescription>
							Verslag, follow-upmail en coachingtips per gesprek.
						</FrameDescription>
					</FrameHeading>
				</FrameHeader>
				<DataTable
					rows={sessions ?? []}
					columns={columns}
					getRowKey={(row) => row._id}
					loading={sessions === undefined}
					noun="gesprekken"
					defaultSort={{ id: "datum", dir: "desc" }}
					renderRow={(row, cells) => (
						<TableRow key={row._id} className="cursor-pointer">
							<Link
								to="/coach/$sessionId"
								params={{ sessionId: row._id }}
								className="contents"
							>
								{cells}
							</Link>
						</TableRow>
					)}
					empty={
						<EmptyState
							icon={MessagesSquareIcon}
							title="Nog geen gesprekken"
							description="Start de coach vlak voor je volgende Meet. Na afloop staat hier het verslag."
						/>
					}
				/>
			</Frame>
		</>
	);
}

function StartCard() {
	const navigate = useNavigate();
	const clients = useQuery(api.clients.list);
	const [title, setTitle] = useState("");
	const [clientId, setClientId] = useState<string>(NO_CLIENT);
	const [goal, setGoal] = useState("");
	const [agendaText, setAgendaText] = useState("");
	const [context, setContext] = useState(() => stored(CONTEXT_KEY, ""));
	const [myName, setMyName] = useState(() => stored(NAME_KEY, "Arin"));
	const [useMic, setUseMic] = useState(true);
	const [more, setMore] = useState(false);
	const micId = useId();
	const phase = useRecorder((s) => s.phase);
	const error = useRecorder((s) => s.error);

	const agenda = parseAgenda(agendaText);
	const plannedMin = agenda.reduce((n, a) => n + (a.minutes ?? 0), 0);
	const clientItems = [
		{ value: NO_CLIENT, label: "Geen klant" },
		...(clients ?? [])
			.map((c) => ({ value: c._id, label: c.companyName || c.name }))
			.sort((a, b) => a.label.localeCompare(b.label, "nl")),
	];
	const starting = phase === "starting";

	const start = async () => {
		remember(CONTEXT_KEY, context);
		remember(NAME_KEY, myName);
		let sessionId: Id<"coachSessions">;
		try {
			sessionId = await recorder.start(
				{
					title,
					clientId:
						clientId === NO_CLIENT ? undefined : (clientId as Id<"clients">),
					goal: goal || undefined,
					context: context || undefined,
					myName: myName || undefined,
					agenda,
				},
				useMic,
			);
		} catch (err) {
			toast.error("Starten lukte niet", {
				description: err instanceof Error ? err.message : undefined,
			});
			return;
		}
		// Lukt alleen als de klik nog "vers" is; anders staat er een knop klaar.
		if (pipSupported()) {
			await openCoachWindow(sessionId).catch(() => {});
		}
		await navigate({ to: "/coach/$sessionId", params: { sessionId } });
	};

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Meeting coach</FrameTitle>
					<FrameDescription>
						Luistert mee met je Google Meet en geeft rustig tips op het juiste
						moment. Eén klik om te starten, één om te stoppen.
					</FrameDescription>
				</FrameHeading>
			</FrameHeader>
			<FramePanel className="p-5">
				<form
					className="grid gap-4 lg:grid-cols-[1fr_1fr]"
					onSubmit={(event) => {
						event.preventDefault();
						void start();
					}}
					onFocus={() => void recorder.prefetch().catch(() => {})}
				>
					<div className="flex flex-col gap-4">
						<Field label="Gesprek">
							<Input
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Kennismaking nieuwe webshop"
							/>
						</Field>
						<Field label="Klant">
							<Select
								items={clientItems}
								value={clientId}
								onValueChange={(v) => setClientId(v ?? NO_CLIENT)}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{clientItems.map((c) => (
										<SelectItem key={c.value} value={c.value}>
											{c.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field label="Doel" hint="Eén zin. De coach stuurt hierop.">
							<Input
								value={goal}
								onChange={(e) => setGoal(e.target.value)}
								placeholder="Scope en budget helder, vervolgafspraak gepland"
							/>
						</Field>
					</div>
					<div className="flex flex-col gap-4">
						<Field
							label="Agenda"
							hint={
								agenda.length
									? `${agenda.length} ${agenda.length === 1 ? "punt" : "punten"}${plannedMin ? ` · ${plannedMin} min` : ""}`
									: "Eén punt per regel, minuten erachter. Plakken mag."
							}
						>
							<Textarea
								value={agendaText}
								onChange={(e) => setAgendaText(e.target.value)}
								placeholder={
									"Kennismaking 5\nHuidige situatie 10\nWensen 15\nBudget en planning 10\nVervolgstappen 5"
								}
								className="min-h-[8.5rem] font-mono text-xs md:text-xs"
							/>
						</Field>
					</div>

					<div className="lg:col-span-2">
						<button
							type="button"
							onClick={() => setMore((v) => !v)}
							className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
						>
							<ChevronDownIcon
								className={cn(
									"size-3.5 transition-transform",
									more && "rotate-180",
								)}
							/>
							Achtergrond voor de coach{context ? " (ingevuld)" : ""}
						</button>
						{more ? (
							<div className="mt-3 grid gap-4 animate-in fade-in slide-in-from-top-1 duration-200 lg:grid-cols-[1fr_12rem]">
								<Field
									label="Wat de coach moet weten"
									hint="Tarieven, wat je wil verkopen, gevoeligheden. Blijft bewaard in deze browser."
								>
									<Textarea
										value={context}
										onChange={(e) => setContext(e.target.value)}
										placeholder="Beheer 195 euro per maand. Koppelingen zijn meerwerk. Nooit een livedatum noemen voor de discovery."
										className="min-h-20"
									/>
								</Field>
								<Field label="Mijn naam">
									<Input
										value={myName}
										onChange={(e) => setMyName(e.target.value)}
									/>
								</Field>
							</div>
						) : null}
					</div>

					<div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center lg:col-span-2">
						<div className="flex items-center gap-2 text-sm">
							<Switch id={micId} checked={useMic} onCheckedChange={setUseMic} />
							<label htmlFor={micId}>Mijn microfoon</label>
							<span className="text-muted-foreground flex items-center gap-1 text-xs">
								<HeadphonesIcon className="size-3.5" />
								met koptelefoon het best
							</span>
						</div>
						<div className="flex items-center gap-3 sm:ml-auto">
							<span className="text-muted-foreground hidden text-xs md:inline">
								Kies daarna het Meet-tabblad en zet tabblad-audio aan.
							</span>
							<Button
								type="submit"
								size="lg"
								disabled={starting}
								className="px-4"
							>
								{starting ? (
									<RadioIcon className="size-4 animate-pulse" />
								) : (
									<PlayIcon className="size-4" />
								)}
								{starting ? "Wacht op Meet-tabblad…" : "Start"}
							</Button>
						</div>
					</div>
					{error && !starting ? (
						<p className="text-destructive text-sm lg:col-span-2">{error}</p>
					) : null}
				</form>
			</FramePanel>
		</Frame>
	);
}

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="flex items-baseline justify-between gap-2">
				<span className="text-sm font-medium">{label}</span>
				{hint ? (
					<span className="text-muted-foreground text-xs">{hint}</span>
				) : null}
			</span>
			{children}
		</div>
	);
}
