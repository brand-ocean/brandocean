import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	CheckIcon,
	ClockIcon,
	CopyIcon,
	HelpCircleIcon,
	LightbulbIcon,
	MailIcon,
	MessageSquareIcon,
	RefreshCwIcon,
	SparklesIcon,
	Trash2Icon,
	UserRoundIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { StatStrip } from "@/components/app/stat-strip";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";
import {
	clock,
	copyText,
	formatDate,
	NUDGE_META,
	speakerLabel,
} from "./format";
import { Shots } from "./live-view";

type Session = Doc<"coachSessions">;
type Report = Doc<"coachReports">;

const NO_CLIENT = "__none__";

function CopyButton({
	text,
	label = "Kopieer",
}: {
	text: string;
	label?: string;
}) {
	const [done, setDone] = useState(false);
	return (
		<Button
			size="sm"
			variant="outline"
			onClick={async () => {
				if (await copyText(text)) {
					setDone(true);
					setTimeout(() => setDone(false), 1500);
				} else {
					toast.error("Kopiëren lukte niet");
				}
			}}
		>
			{done ? <CheckIcon /> : <CopyIcon />}
			{done ? "Gekopieerd" : label}
		</Button>
	);
}

function asMarkdown(session: Session, report: Report): string {
	const lines = [
		`# ${session.title}`,
		`${formatDate(session.startedAt)}${session.clientName ? ` · ${session.clientName}` : ""}`,
		"",
		"## Samenvatting",
		...report.summary.map((s) => `- ${s}`),
	];
	if (report.decisions.length) {
		lines.push("", "## Besluiten", ...report.decisions.map((s) => `- ${s}`));
	}
	if (report.actionItems.length) {
		lines.push(
			"",
			"## Actiepunten",
			...report.actionItems.map(
				(a) => `- ${a.owner}: ${a.what}${a.when ? ` (${a.when})` : ""}`,
			),
		);
	}
	if (report.openQuestions.length) {
		lines.push(
			"",
			"## Open vragen",
			...report.openQuestions.map((s) => `- ${s}`),
		);
	}
	return lines.join("\n");
}

const TABS = [
	{ id: "verslag", label: "Verslag" },
	{ id: "transcript", label: "Transcript" },
	{ id: "tips", label: "Alle tips" },
	{ id: "scherm", label: "Scherm" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** Na het gesprek: verslag, mail, tips, en het hele gesprek terug te lezen. */
export function ReportView({
	session,
	report,
}: {
	session: Session;
	report: Report | null;
}) {
	const [tab, setTab] = useState<Tab>("verslag");
	return (
		<>
			<Header session={session} />
			{session.status === "finishing" ? (
				<Frame>
					<FramePanel className="flex items-center gap-3 p-6">
						<SparklesIcon className="size-5 animate-pulse text-violet-500" />
						<div>
							<p className="font-medium">Het verslag wordt gemaakt…</p>
							<p className="text-muted-foreground text-sm">
								Samenvatting, actiepunten, een follow-upmail en drie tips.
								Meestal binnen een minuut.
							</p>
						</div>
					</FramePanel>
				</Frame>
			) : null}
			{session.status === "error" ? <Failed session={session} /> : null}

			<div className="flex gap-1 rounded-lg border bg-muted/50 p-1 self-start">
				{TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						onClick={() => setTab(t.id)}
						className={cn(
							"rounded-md px-3 py-1 text-sm transition-colors",
							tab === t.id
								? "bg-background font-medium shadow-xs"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{t.label}
					</button>
				))}
			</div>

			{tab === "verslag" ? (
				report ? (
					<ReportBody session={session} report={report} />
				) : session.status === "done" ? null : (
					<p className="text-muted-foreground text-sm">Nog geen verslag.</p>
				)
			) : null}
			{tab === "transcript" ? <FullTranscript session={session} /> : null}
			{tab === "tips" ? <AllNudges session={session} /> : null}
			{tab === "scherm" ? (
				<div className="max-w-2xl">
					<Shots session={session} limit={200} />
				</div>
			) : null}
		</>
	);
}

function Header({ session }: { session: Session }) {
	const navigate = useNavigate();
	const clients = useQuery(api.clients.list);
	const update = useMutation(api.coach.sessions.update);
	const remove = useMutation(api.coach.sessions.remove);
	const items = [
		{ value: NO_CLIENT, label: "Geen klant" },
		...(clients ?? [])
			.map((c) => ({ value: c._id, label: c.companyName || c.name }))
			.sort((a, b) => a.label.localeCompare(b.label, "nl")),
	];
	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>{session.title}</FrameTitle>
					<FrameDescription>
						{formatDate(session.startedAt)}
						{session.durationMs ? ` · ${clock(session.durationMs)}` : ""}
						{session.goal ? ` · ${session.goal}` : ""}
					</FrameDescription>
				</FrameHeading>
				<div className="flex items-center gap-2">
					<Select
						items={items}
						value={session.clientId ?? NO_CLIENT}
						onValueChange={(v) =>
							void update({
								sessionId: session._id,
								clientId: !v || v === NO_CLIENT ? null : (v as Id<"clients">),
							})
						}
					>
						<SelectTrigger size="sm" className="w-48">
							<UserRoundIcon className="text-muted-foreground size-3.5" />
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{items.map((c) => (
								<SelectItem key={c.value} value={c.value}>
									{c.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						size="icon-sm"
						variant="ghost"
						title="Verwijderen"
						onClick={async () => {
							if (
								!window.confirm(
									"Dit gesprek met transcript en verslag verwijderen?",
								)
							) {
								return;
							}
							await remove({ sessionId: session._id });
							await navigate({ to: "/coach" });
						}}
					>
						<Trash2Icon />
					</Button>
				</div>
			</FrameHeader>
		</Frame>
	);
}

function Failed({ session }: { session: Session }) {
	const retry = useMutation(api.coach.sessions.retryReport);
	return (
		<Frame>
			<FramePanel className="flex items-center gap-3 p-5">
				<p className="flex-1 text-sm">
					Het verslag maken is mislukt. Het transcript is bewaard.
				</p>
				<Button
					size="sm"
					onClick={() => void retry({ sessionId: session._id })}
				>
					<RefreshCwIcon />
					Opnieuw proberen
				</Button>
			</FramePanel>
		</Frame>
	);
}

function Section({
	title,
	icon: Icon,
	action,
	children,
}: {
	title: string;
	icon?: React.ComponentType<{ className?: string }>;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle className="flex items-center gap-2">
						{Icon ? <Icon className="text-muted-foreground size-4" /> : null}
						{title}
					</FrameTitle>
				</FrameHeading>
				{action}
			</FrameHeader>
			<FramePanel className="p-5">{children}</FramePanel>
		</Frame>
	);
}

function Bullets({ items }: { items: readonly string[] }) {
	return (
		<ul className="flex flex-col gap-1.5 leading-relaxed">
			{items.map((item) => (
				<li key={item} className="flex gap-2">
					<span className="text-muted-foreground">•</span>
					<span>{item}</span>
				</li>
			))}
		</ul>
	);
}

function ReportBody({ session, report }: { session: Session; report: Report }) {
	const retry = useMutation(api.coach.sessions.retryReport);
	const client = useQuery(
		api.clients.list,
		session.clientId ? {} : "skip",
	)?.find((c) => c._id === session.clientId);
	const s = report.stats;
	const unknownMe = session.mode === "live" && !session.meLabel;
	const email = report.emailBody
		? `${report.emailSubject ? `Onderwerp: ${report.emailSubject}\n\n` : ""}${report.emailBody}`
		: "";
	const to = client?.email?.split(",")[0]?.trim() ?? "";
	const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(report.emailSubject)}&body=${encodeURIComponent(report.emailBody)}`;
	return (
		<div className="grid gap-4.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div className="flex flex-col gap-4.5 xl:col-span-2">
				<Frame>
					<FramePanel>
						<StatStrip
							items={[
								{
									label: "Duur",
									icon: ClockIcon,
									value: clock(s.durationMs),
									hint: s.plannedMinutes
										? `gepland ${s.plannedMinutes} min`
										: undefined,
								},
								{
									label: `${session.myName} aan het woord`,
									icon: MessageSquareIcon,
									value: unknownMe ? "—" : `${Math.round(s.myShare * 100)}%`,
									hint: unknownMe
										? "niet vastgesteld wie jij was"
										: s.myShare > 0.6
											? "veel, liefst onder 50%"
											: "mooi in balans",
								},
								{
									label: "Vragen gesteld",
									icon: HelpCircleIcon,
									value: s.questionsAsked,
									hint: "door jou",
								},
								{
									label: "Tips getoond",
									icon: LightbulbIcon,
									value: s.nudges,
									hint: `AI-kosten $${s.costUsd.toFixed(2)}`,
								},
							]}
						/>
					</FramePanel>
				</Frame>
			</div>

			<Section
				title="Samenvatting"
				action={
					<div className="flex gap-2">
						<Button
							size="sm"
							variant="ghost"
							title="Opnieuw maken"
							onClick={() => void retry({ sessionId: session._id })}
						>
							<RefreshCwIcon />
						</Button>
						<CopyButton
							text={asMarkdown(session, report)}
							label="Kopieer verslag"
						/>
					</div>
				}
			>
				<Bullets items={report.summary} />
				{report.decisions.length ? (
					<div className="mt-5">
						<p className="text-muted-foreground mb-1.5 text-[0.6875rem] font-medium tracking-wide uppercase">
							Besluiten
						</p>
						<Bullets items={report.decisions} />
					</div>
				) : null}
				{report.openQuestions.length ? (
					<div className="mt-5">
						<p className="text-muted-foreground mb-1.5 text-[0.6875rem] font-medium tracking-wide uppercase">
							Open vragen
						</p>
						<Bullets items={report.openQuestions} />
					</div>
				) : null}
			</Section>

			<Section
				title="Actiepunten"
				action={
					report.actionItems.length ? (
						<CopyButton
							text={report.actionItems
								.map(
									(a) =>
										`- ${a.owner}: ${a.what}${a.when ? ` (${a.when})` : ""}`,
								)
								.join("\n")}
						/>
					) : null
				}
			>
				{report.actionItems.length ? (
					<ul className="flex flex-col divide-y">
						{report.actionItems.map((a) => (
							<li
								key={`${a.owner}-${a.what}`}
								className="flex gap-3 py-2 first:pt-0 last:pb-0"
							>
								<span className="bg-muted h-fit shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium">
									{a.owner}
								</span>
								<span className="flex-1 leading-snug">{a.what}</span>
								{a.when ? (
									<span className="text-muted-foreground shrink-0 text-xs">
										{a.when}
									</span>
								) : null}
							</li>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground text-sm">Geen actiepunten.</p>
				)}
			</Section>

			{email ? (
				<Section
					title="Follow-upmail"
					icon={MailIcon}
					action={
						<div className="flex gap-2">
							<a
								href={mailto}
								className={buttonVariants({ size: "sm", variant: "outline" })}
							>
								<MailIcon />
								Open in mail
							</a>
							<CopyButton text={email} />
						</div>
					}
				>
					{report.emailSubject ? (
						<p className="mb-3 font-medium">{report.emailSubject}</p>
					) : null}
					<p className="text-sm leading-relaxed whitespace-pre-wrap">
						{report.emailBody}
					</p>
				</Section>
			) : null}

			{report.tips.length ? (
				<Section title="Coaching voor jou" icon={LightbulbIcon}>
					<ol className="flex flex-col gap-4">
						{report.tips.map((t, i) => (
							<li key={t.title} className="flex gap-3">
								<span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
									{i + 1}
								</span>
								<div>
									<p className="font-medium">{t.title}</p>
									<p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
										{t.text}
									</p>
								</div>
							</li>
						))}
					</ol>
				</Section>
			) : null}
		</div>
	);
}

function FullTranscript({ session }: { session: Session }) {
	const chunks = useQuery(api.coach.sessions.chunks, {
		sessionId: session._id,
	});
	const text = (chunks ?? [])
		.map(
			(c) =>
				`[${clock(c.at - session.startedAt)}] ${speakerLabel(session, c)}: ${c.text}`,
		)
		.join("\n");
	return (
		<Section
			title="Transcript"
			action={chunks?.length ? <CopyButton text={text} /> : null}
		>
			{chunks === undefined ? (
				<p className="text-muted-foreground text-sm">Laden…</p>
			) : chunks.length === 0 ? (
				<p className="text-muted-foreground text-sm">Er is niets opgenomen.</p>
			) : (
				<div className="flex flex-col gap-2 text-sm">
					{chunks.map((c) => (
						<p key={c._id} className="leading-relaxed">
							<span className="text-muted-foreground mr-2 text-xs tabular-nums">
								{clock(c.at - session.startedAt)}
							</span>
							<span className={cn("font-medium", c.isMine && "text-primary")}>
								{speakerLabel(session, c)}:
							</span>{" "}
							{c.text}
						</p>
					))}
				</div>
			)}
		</Section>
	);
}

function AllNudges({ session }: { session: Session }) {
	const nudges = useQuery(api.coach.sessions.nudges, {
		sessionId: session._id,
	});
	return (
		<Section title="Alle tips tijdens het gesprek">
			{nudges === undefined ? (
				<p className="text-muted-foreground text-sm">Laden…</p>
			) : nudges.length === 0 ? (
				<p className="text-muted-foreground text-sm">Geen tips getoond.</p>
			) : (
				<div className="flex flex-col gap-3">
					{[...nudges].reverse().map((n) => {
						const meta = NUDGE_META[n.type];
						const Icon = meta.icon;
						return (
							<div key={n._id} className="flex gap-3 text-sm">
								<span className="text-muted-foreground w-10 shrink-0 text-xs tabular-nums">
									{clock(n.at - session.startedAt)}
								</span>
								<Icon className={cn("mt-0.5 size-4 shrink-0", meta.accent)} />
								<div>
									<p>
										<span className={cn("font-medium", meta.accent)}>
											{meta.label}:
										</span>{" "}
										{n.text}
									</p>
									{n.detail ? (
										<p className="text-muted-foreground leading-snug">
											{n.detail}
										</p>
									) : null}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</Section>
	);
}
