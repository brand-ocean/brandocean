import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { api } from "~convex/_generated/api";
import type { Doc } from "~convex/_generated/dataModel";
import { timeAgo } from "./index";

/**
 * Eén bord: wie kijkt er nu, hoe ver komen kijkers in de route, welke
 * kaarten krijgen de aandacht, wat zoeken ze, en wie klikte op contact.
 * Alles wordt hier uit de ruwe events geteld; de query levert de laatste
 * paar duizend, nieuwste eerst, en Convex houdt het live.
 */
export const Route = createFileRoute("/_authed/_app/borden/$slug")({
	component: BordPage,
});

type Ev = Doc<"previewEvents">;

const LIVE_MS = 90_000;

function fmtMs(ms: number): string {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	return `${m}m ${s % 60}s`;
}

function BordPage() {
	const { slug } = Route.useParams();
	const events = useQuery(api.previewTrack.events, { slug });
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const t = window.setInterval(() => setNow(Date.now()), 15_000);
		return () => window.clearInterval(t);
	}, []);

	const open = events?.find((e) => e.kind === "open");
	const client = open?.data?.client ?? slug;
	usePageTitle(client);

	const stats = useMemo(() => summarize(events ?? [], now), [events, now]);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Terug naar borden"
							render={<Link to="/borden" />}
						>
							<ArrowLeftIcon />
						</Button>
						{client}
					</FrameTitle>
					<FrameDescription>
						{open?.data?.title ?? `/preview/${slug}`} · {stats.visitors}{" "}
						{stats.visitors === 1 ? "kijker" : "kijkers"}, {stats.sessions}{" "}
						{stats.sessions === 1 ? "bezoek" : "bezoeken"}
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<Button
						variant="outline"
						size="sm"
						render={
							<a
								href={`https://brandocean.nl/preview/${slug}/beheer`}
								target="_blank"
								rel="noreferrer"
							>
								Bord openen <ExternalLinkIcon />
							</a>
						}
					/>
				</FrameActions>
			</FrameHeader>

			{/* Nu op het bord */}
			<FramePanel>
				<h3 className="mb-2 text-sm font-medium">Nu op het bord</h3>
				{stats.live.length ? (
					<ul className="flex flex-col gap-1.5">
						{stats.live.map((l) => (
							<li key={l.session} className="flex items-center gap-2 text-sm">
								<TonePill dot tone="success">
									live
								</TonePill>
								<span className="text-muted-foreground">{l.device}</span>
								<span>{l.where}</span>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-muted-foreground">
						Niemand op dit moment.
					</p>
				)}
			</FramePanel>

			<div className="grid gap-px md:grid-cols-2">
				{/* Route-funnel */}
				<FramePanel>
					<h3 className="mb-3 text-sm font-medium">Route: hoe ver komen ze</h3>
					{stats.steps.length ? (
						<ol className="flex flex-col gap-2">
							{stats.steps.map((s) => (
								<li key={s.step} className="text-sm">
									<div className="mb-1 flex items-baseline justify-between gap-3">
										<span className="truncate">
											<span className="font-mono text-xs text-muted-foreground">
												{s.step}
											</span>{" "}
											{s.label}
										</span>
										<span className="shrink-0 tabular-nums text-muted-foreground">
											{s.sessions}× · gem. {fmtMs(s.avgMs)}
										</span>
									</div>
									<div className="h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-primary"
											style={{
												width: `${Math.round((100 * s.sessions) / Math.max(1, stats.sessions))}%`,
											}}
										/>
									</div>
								</li>
							))}
							<li className="mt-1 flex items-center justify-between text-sm">
								<span>Afsluiter gezien</span>
								<span className="tabular-nums text-muted-foreground">
									{stats.closing}×
								</span>
							</li>
						</ol>
					) : (
						<p className="text-sm text-muted-foreground">
							Nog niemand heeft de route gelopen.
						</p>
					)}
				</FramePanel>

				{/* Aandacht per kaart */}
				<FramePanel>
					<h3 className="mb-3 text-sm font-medium">Waar ze naar kijken</h3>
					{stats.cards.length ? (
						<ol className="flex flex-col gap-2">
							{stats.cards.map((c) => (
								<li key={c.card} className="text-sm">
									<div className="mb-1 flex items-baseline justify-between gap-3">
										<span className="truncate">{c.label}</span>
										<span className="shrink-0 tabular-nums text-muted-foreground">
											{fmtMs(c.ms)} · {c.visitors}{" "}
											{c.visitors === 1 ? "kijker" : "kijkers"}
										</span>
									</div>
									<div className="h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-primary/70"
											style={{
												width: `${Math.round((100 * c.ms) / Math.max(1, stats.cards[0].ms))}%`,
											}}
										/>
									</div>
								</li>
							))}
						</ol>
					) : (
						<p className="text-sm text-muted-foreground">
							Nog geen kaart lang genoeg in beeld.
						</p>
					)}
				</FramePanel>
			</div>

			<div className="grid gap-px md:grid-cols-2">
				{/* Contact en zoeken */}
				<FramePanel>
					<h3 className="mb-3 text-sm font-medium">Contact en zoeken</h3>
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						<dt className="text-muted-foreground">Mail</dt>
						<dd className="tabular-nums">{stats.cta.mail}×</dd>
						<dt className="text-muted-foreground">WhatsApp</dt>
						<dd className="tabular-nums">{stats.cta.whatsapp}×</dd>
						<dt className="text-muted-foreground">Bellen</dt>
						<dd className="tabular-nums">{stats.cta.tel}×</dd>
					</dl>
					{stats.searches.length ? (
						<ul className="mt-3 flex flex-wrap gap-1.5">
							{stats.searches.map((s) => (
								<li key={s}>
									<TonePill tone="muted">{s}</TonePill>
								</li>
							))}
						</ul>
					) : null}
				</FramePanel>

				{/* Bezoeken */}
				<FramePanel>
					<h3 className="mb-3 text-sm font-medium">Bezoeken</h3>
					{stats.visits.length ? (
						<ul className="flex flex-col gap-2">
							{stats.visits.map((v) => (
								<li
									key={v.session}
									className="flex items-baseline justify-between gap-3 text-sm"
								>
									<span className="min-w-0 truncate">
										<span className="text-muted-foreground">
											{v.device}
											{v.returning ? " · terug" : ""}
											{v.referrer ? ` · via ${v.referrer}` : ""}
										</span>
										{v.lastStep ? ` · tot stap ${v.lastStep}` : ""}
										{v.closing ? " · afsluiter" : ""}
										{v.cta ? ` · ${v.cta}` : ""}
									</span>
									<span className="shrink-0 tabular-nums text-muted-foreground">
										{v.ms ? `${fmtMs(v.ms)} · ` : ""}
										{timeAgo(v.at)}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-muted-foreground">Nog geen bezoek.</p>
					)}
				</FramePanel>
			</div>
		</Frame>
	);
}

/** Telt de ruwe events op tot wat de pagina laat zien. */
function summarize(events: Ev[], now: number) {
	const sessions = new Set<string>();
	const visitors = new Set<string>();
	const stepStats = new Map<
		number,
		{ label: string; sessions: Set<string>; ms: number; n: number }
	>();
	const cardStats = new Map<
		string,
		{ label: string; ms: number; visitors: Set<string> }
	>();
	const cta = { mail: 0, whatsapp: 0, tel: 0 };
	const searches = new Set<string>();
	let closing = 0;
	const visits = new Map<
		string,
		{
			session: string;
			at: number;
			device: string;
			returning: boolean;
			referrer: string;
			lastStep: number;
			closing: boolean;
			cta: string;
			ms: number;
			lastAt: number;
			where: string;
		}
	>();

	// events staan nieuwste eerst; voor stap-duur lopen we oud → nieuw
	const asc = [...events].reverse();
	const stepOpen = new Map<string, { step: number; at: number }>();
	for (const e of asc) {
		sessions.add(e.session);
		visitors.add(e.visitor);
		const v = visits.get(e.session) ?? {
			session: e.session,
			at: e.at,
			device: "",
			returning: false,
			referrer: "",
			lastStep: 0,
			closing: false,
			cta: "",
			ms: 0,
			lastAt: e.at,
			where: "",
		};
		v.lastAt = Math.max(v.lastAt, e.at);
		const d = e.data ?? {};
		switch (e.kind) {
			case "open":
				v.at = e.at;
				v.device = d.device ?? "";
				v.returning = !!d.returning;
				v.referrer = d.referrer ?? "";
				break;
			case "step": {
				const prev = stepOpen.get(e.session);
				if (prev) {
					const st = stepStats.get(prev.step);
					if (st) {
						st.ms += Math.min(e.at - prev.at, 10 * 60_000);
						st.n++;
					}
				}
				const step = d.step ?? 0;
				const st = stepStats.get(step) ?? {
					label: d.label ?? "",
					sessions: new Set<string>(),
					ms: 0,
					n: 0,
				};
				st.sessions.add(e.session);
				stepStats.set(step, st);
				stepOpen.set(e.session, { step, at: e.at });
				v.lastStep = Math.max(v.lastStep, step);
				v.where = `stap ${step}: ${d.label ?? ""}`;
				break;
			}
			case "view": {
				const key = d.card ?? "";
				const cs = cardStats.get(key) ?? {
					label: d.label ?? key,
					ms: 0,
					visitors: new Set<string>(),
				};
				cs.ms += d.ms ?? 0;
				cs.visitors.add(e.visitor);
				cardStats.set(key, cs);
				v.where = d.label ?? "";
				break;
			}
			case "fly":
				v.where = d.label ?? "";
				break;
			case "search":
				if (d.q) searches.add(d.q);
				break;
			case "closing":
				closing++;
				v.closing = true;
				v.where = "afsluiter";
				break;
			case "cta":
				if (d.cta === "mail") cta.mail++;
				else if (d.cta === "whatsapp") cta.whatsapp++;
				else if (d.cta === "tel") cta.tel++;
				v.cta = d.cta ?? "";
				break;
			case "leave":
				v.ms = Math.max(v.ms, d.ms ?? 0);
				break;
		}
		visits.set(e.session, v);
	}

	const steps = [...stepStats.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([step, s]) => ({
			step,
			label: s.label,
			sessions: s.sessions.size,
			avgMs: s.n ? s.ms / s.n : 0,
		}));
	const cards = [...cardStats.entries()]
		.map(([card, c]) => ({
			card,
			label: c.label,
			ms: c.ms,
			visitors: c.visitors.size,
		}))
		.sort((a, b) => b.ms - a.ms)
		.slice(0, 10);
	const visitList = [...visits.values()].sort((a, b) => b.at - a.at);
	const live = visitList
		.filter((v) => now - v.lastAt < LIVE_MS && !v.ms)
		.map((v) => ({
			session: v.session,
			device: v.device,
			where: v.where || "op het bord",
		}));

	return {
		sessions: sessions.size,
		visitors: visitors.size,
		steps,
		closing,
		cards,
		cta,
		searches: [...searches].slice(0, 20),
		visits: visitList.slice(0, 30),
		live,
	};
}
