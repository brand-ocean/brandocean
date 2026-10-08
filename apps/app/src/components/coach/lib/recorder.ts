import { getConvexClient } from "@/lib/convex";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";
import {
	AudioPipeline,
	CaptureError,
	type PcmFrame,
	SceneChangeDetector,
	type Source,
} from "./audio";
import {
	type FinalLine,
	GatewayTranscriber,
	SpeechmaticsTranscriber,
	type StreamStatus,
	type Transcriber,
} from "./transcription";

// De live kant van de coach, buiten React: tabblad en microfoon vastpakken,
// transcriptie voeden, stilte en monoloog meten, screenshots bij een nieuw
// scherm, en elke ±5 s een hartslag naar de server. Eén exemplaar per
// browsertab (module-singleton), zodat navigeren binnen de app niets stopt.
//
// Alles wat op tijd moet gebeuren hangt aan de audioblokjes (10 per seconde)
// in plaats van aan timers: Chrome remt timers af in een tabblad op de
// achtergrond, en dat is precies waar deze pagina staat tijdens een Meet.

export type Phase = "idle" | "starting" | "live" | "stopping";
export type Kind = "speechmatics" | "gateway";

export type CoachMode = "online" | "live";

export type CoachSetup = {
	/** online = Meet-tabblad + microfoon; live = alleen de microfoon. */
	mode?: CoachMode;
	/** Model voor diepe ronde, vragen en verslag. */
	model?: Doc<"coachSessions">["model"];
	title: string;
	clientId?: Id<"clients">;
	goal?: string;
	context?: string;
	myName?: string;
	agenda: { title: string; minutes?: number }[];
	plannedMinutes?: number;
};

export type RecorderSnapshot = {
	sessionId: Id<"coachSessions"> | null;
	phase: Phase;
	mode: CoachMode;
	kind: Kind | null;
	hint: string | null;
	status: Record<Source, StreamStatus | "off">;
	interim: Record<Source, string>;
	levels: Record<Source, number>;
	speaking: Record<Source, boolean>;
	sharing: boolean;
	tabAudio: boolean;
	micOn: boolean;
	pending: number;
	warning: string | null;
	error: string | null;
	shooting: boolean;
	myStreakMs: number;
	silenceMs: number;
	now: number;
	pipOpen: boolean;
	/** Microfoonversterking 1–6×, en het niveau ná versterking. */
	micGain: number;
	micDevice: string;
	micPeak: number;
	micClip: boolean;
	/** Fysiek: al een halve minuut weinig geluid binnen. */
	lowLevel: boolean;
};

const INITIAL: RecorderSnapshot = {
	sessionId: null,
	phase: "idle",
	mode: "online",
	kind: null,
	hint: null,
	status: { mic: "off", tab: "off" },
	interim: { mic: "", tab: "" },
	levels: { mic: 0, tab: 0 },
	speaking: { mic: false, tab: false },
	sharing: false,
	tabAudio: false,
	micOn: false,
	pending: 0,
	warning: null,
	error: null,
	shooting: false,
	myStreakMs: 0,
	silenceMs: 0,
	now: 0,
	pipOpen: false,
	micGain: 1,
	micDevice: "",
	micPeak: 0,
	micClip: false,
	lowLevel: false,
};

/** Boven dit RMS-niveau telt een blokje van 100 ms als spraak. */
const VOICE_RMS: Record<Source, number> = { mic: 0.02, tab: 0.012 };
/** Een pauze korter dan dit onderbreekt een monoloog niet. */
const STREAK_GAP_MS = 2_500;
/** Zoveel spraak van de anderen breekt jouw monoloog. */
const OTHERS_BREAK_MS = 1_200;
const PULSE_MS = 5_000;

const BASE_VOCAB = [
	"Brand Ocean",
	"Shopify",
	"WooCommerce",
	"Webflow",
	"Klaviyo",
	"Mailchimp",
	"Exact",
	"Moneybird",
	"Convex",
	"TanStack",
	"Cloudflare",
];

type ProviderInfo = { kind: Kind; hint: string | null };

const GAIN_KEY = "coach.micGain";
const DEVICE_KEY = "coach.micDevice";

function readSetting(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeSetting(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// privé-venster
	}
}

/** Bewaarde versterking; anders 2,5× voor een fysiek gesprek, 1× online. */
export function storedMicGain(mode: CoachMode): number {
	const v = Number(readSetting(`${GAIN_KEY}.${mode}`));
	return Number.isFinite(v) && v >= 1 && v <= 6 ? v : mode === "live" ? 2.5 : 1;
}

export function rememberMicGain(mode: CoachMode, value: number) {
	writeSetting(`${GAIN_KEY}.${mode}`, String(value));
}

export function rememberMicDevice(deviceId: string) {
	writeSetting(DEVICE_KEY, deviceId);
}

export function storedMicDevice(): string {
	return readSetting(DEVICE_KEY) ?? "";
}

class CoachRecorder {
	private snap: RecorderSnapshot = INITIAL;
	private listeners = new Set<() => void>();
	private pipeline: AudioPipeline | null = null;
	private transcriber: Transcriber | null = null;
	private provider: Promise<ProviderInfo> | null = null;
	private vocab: string[] = [];
	private detector = new SceneChangeDetector();
	private framesSinceSample = 0;
	private lastEmitAt = 0;
	private lastPulseAt = 0;
	private lastVoice: Record<Source, number> = { mic: 0, tab: 0 };
	private streakStart = 0;
	private othersInStreakMs = 0;
	private inflight = new Set<Promise<number | null>>();
	private ticker: ReturnType<typeof setInterval> | null = null;
	private pipWindow: Window | null = null;
	private teardown: (() => void)[] = [];

	// ---- Store ----------------------------------------------------------------

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = (): RecorderSnapshot => this.snap;

	getServerSnapshot = (): RecorderSnapshot => INITIAL;

	private set(patch: Partial<RecorderSnapshot>) {
		this.snap = { ...this.snap, ...patch };
		for (const l of this.listeners) l();
	}

	dismissWarning = () => this.set({ warning: null });

	// ---- Provider ----------------------------------------------------------------

	/** Al ophalen tijdens het invullen, zodat Start meteen kan. */
	prefetch(): Promise<ProviderInfo> {
		if (!this.provider) {
			this.provider = getConvexClient()
				.action(api.coach.ai.transcriptionProvider, {})
				.catch((error: Error) => {
					this.provider = null;
					throw error;
				});
		}
		return this.provider;
	}

	// ---- Start ---------------------------------------------------------------------

	/**
	 * Vanuit de Start-klik: tabblad delen, microfoon, sessie aanmaken en
	 * luisteren. Geeft de sessie terug zodra alles loopt.
	 */
	async start(
		setup: CoachSetup,
		useMic: boolean,
		/** Opnieuw verbinden met een gesprek dat al loopt (na herladen). */
		resume?: Id<"coachSessions">,
	): Promise<Id<"coachSessions">> {
		if (this.snap.phase !== "idle") {
			throw new CaptureError("Er loopt al een gesprek. Stop dat eerst.");
		}
		const mode: CoachMode = setup.mode ?? "online";
		this.set({
			...INITIAL,
			mode,
			phase: "starting",
			now: Date.now(),
			micGain: storedMicGain(mode),
			micDevice: storedMicDevice(),
		});
		const pipeline = new AudioPipeline();
		this.pipeline = pipeline;
		const warnings: string[] = [];
		try {
			if (mode === "live") {
				// Fysiek gesprek: geen tabblad, alleen de microfoon voor iedereen.
				await pipeline.setMic(true, this.micOptions());
			}
			const { hasAudio } =
				mode === "live" ? { hasAudio: true } : await pipeline.shareTab();
			if (!hasAudio) {
				warnings.push(
					"Er komt geen geluid mee van het tabblad, dus de coach hoort de anderen niet. Stop, start opnieuw, kies het Meet-tabblad en zet 'Tabblad-audio delen' aan.",
				);
			}
			if (mode === "live") {
				// microfoon staat al aan
			} else if (useMic) {
				try {
					await pipeline.setMic(true, this.micOptions());
				} catch (error) {
					warnings.push(
						error instanceof Error
							? error.message
							: "Microfoon starten mislukt.",
					);
				}
			} else {
				warnings.push(
					"Zonder microfoon hoort de coach alleen de anderen: spreektijd en monoloog-tips werken dan niet.",
				);
			}
			if (!pipeline.has("tab") && !pipeline.has("mic")) {
				throw new CaptureError(
					"Geen geluid: geen tabblad-audio en geen microfoon. Probeer opnieuw.",
				);
			}
			const provider = await this.prefetch();
			const client = getConvexClient();
			const sessionId =
				resume ?? (await client.mutation(api.coach.sessions.create, setup));
			this.vocab = [
				...BASE_VOCAB,
				setup.myName || "Arin",
				...setup.agenda.flatMap((a) =>
					a.title.split(/\s+/).filter((w) => /^[A-Z][\w-]{3,}$/.test(w)),
				),
			].slice(0, 100);
			pipeline.onTabEnded = () => {
				this.set({
					sharing: false,
					tabAudio: false,
					status: { ...this.snap.status, tab: "off" },
					warning:
						"Het tabblad wordt niet meer gedeeld. De coach hoort de anderen niet meer. Stop en start opnieuw om verder te gaan.",
				});
			};
			pipeline.subscribe((frame) => this.onFrame(frame));
			this.set({
				sessionId,
				phase: "live",
				kind: provider.kind,
				hint: provider.hint,
				sharing: pipeline.sharing,
				tabAudio: pipeline.has("tab"),
				micOn: pipeline.has("mic"),
				warning: warnings.join(" ") || null,
				now: Date.now(),
			});
			this.startTranscriber(provider.kind);
			this.installListeners();
			return sessionId;
		} catch (error) {
			await pipeline.close().catch(() => {});
			this.pipeline = null;
			this.set({
				...INITIAL,
				error:
					error instanceof Error
						? error.message
						: "Starten mislukt. Probeer opnieuw.",
			});
			throw error;
		}
	}

	private startTranscriber(kind: Kind) {
		const pipeline = this.pipeline;
		const sessionId = this.snap.sessionId;
		if (!pipeline || !sessionId) return;
		const client = getConvexClient();
		const transcriber: Transcriber =
			kind === "speechmatics"
				? new SpeechmaticsTranscriber(
						() => client.action(api.coach.ai.speechmaticsToken, { sessionId }),
						this.vocab,
						(message) => {
							// Realtime werkt niet (sleutel, tegoed): door met de gateway.
							if (this.transcriber !== transcriber) return;
							void transcriber.stop();
							this.transcriber = null;
							this.set({
								warning: `${message} Overgeschakeld op de AI Gateway (±15–20 s vertraging).`,
							});
							this.startTranscriber("gateway");
						},
						this.snap.mode === "live",
					)
				: new GatewayTranscriber(async (segment) => {
						await client.action(api.coach.ai.transcribeSegment, {
							sessionId,
							mic: segment.mic,
							tab: segment.tab,
							startedAt: Math.round(segment.startedAt),
							durationMs: Math.round(segment.durationMs),
						});
					});
		this.transcriber = transcriber;
		this.set({
			kind,
			status: {
				mic: pipeline.has("mic") ? "connecting" : "off",
				tab: pipeline.has("tab") ? "connecting" : "off",
			},
		});
		void client
			.mutation(api.coach.sessions.setProvider, { sessionId, provider: kind })
			.catch(() => {});
		transcriber.start(pipeline, {
			onFinal: (line) => this.saveLine(line),
			onInterim: (source, text) => {
				if (this.snap.interim[source] === text) return;
				this.set({ interim: { ...this.snap.interim, [source]: text } });
			},
			onStatus: (source, status, message) => {
				if (this.transcriber !== transcriber) return;
				const next =
					source === "all"
						? {
								mic: pipeline.has("mic") ? status : ("off" as const),
								tab: pipeline.has("tab") ? status : ("off" as const),
							}
						: { ...this.snap.status, [source]: status };
				this.set({
					status: next,
					...(status === "error"
						? { error: message ?? "Transcriptie mislukt." }
						: {}),
				});
			},
			onPending: (pending) => this.set({ pending }),
			onWarning: (warning) => this.set({ warning }),
			onSpeakers: (speakers) => {
				void client
					.mutation(api.coach.sessions.saveSpeakerIds, { sessionId, speakers })
					.catch(() => {});
			},
		});
	}

	/** Live: "Dit ben ik". Daarna meteen stemkenmerken ophalen om te onthouden. */
	setMe = async (label: string | null) => {
		const sessionId = this.snap.sessionId;
		if (!sessionId) return;
		await getConvexClient().mutation(api.coach.sessions.setMe, {
			sessionId,
			label,
		});
		const t = this.transcriber;
		if (t instanceof SpeechmaticsTranscriber) t.requestSpeakers();
	};

	private saveLine(line: FinalLine) {
		const sessionId = this.snap.sessionId;
		if (!sessionId) return;
		// De Convex-client zet mutaties in de wacht bij een netwerkhapering.
		const p = getConvexClient()
			.mutation(api.coach.sessions.addChunks, {
				sessionId,
				chunks: [
					{
						at: line.at,
						source: line.source,
						speaker: line.speaker,
						text: line.text,
						durationMs: line.durationMs,
					},
				],
			})
			.catch((error: Error) => {
				this.set({ warning: `Regel opslaan mislukt: ${error.message}` });
				return null;
			});
		this.inflight.add(p);
		void p.finally(() => this.inflight.delete(p));
	}

	// ---- Elke 100 ms ------------------------------------------------------------------

	private onFrame(frame: PcmFrame) {
		const now = frame.at;
		// Live staat de microfoon verder weg (op tafel): lagere drempel.
		const threshold =
			this.snap.mode === "live" && frame.source === "mic"
				? 0.01
				: VOICE_RMS[frame.source];
		const voice = frame.rms >= threshold;
		if (frame.source === "mic" && this.snap.mode === "live") {
			this.quietFrames.push(frame.rms);
			if (this.quietFrames.length > 300) this.quietFrames.shift();
		}
		if (voice) {
			if (frame.source === "mic") {
				if (!this.streakStart || now - this.lastVoice.mic > STREAK_GAP_MS) {
					this.streakStart = now;
					this.othersInStreakMs = 0;
				}
			} else if (this.streakStart) {
				this.othersInStreakMs += 100;
				if (this.othersInStreakMs >= OTHERS_BREAK_MS) this.streakStart = 0;
			}
			this.lastVoice[frame.source] = now;
		}

		// Screenshots: elke seconde een mini-frame vergelijken.
		if (frame.source === "tab" || !this.pipeline?.has("tab")) {
			if (++this.framesSinceSample >= 10) {
				this.framesSinceSample = 0;
				void this.sampleScreen();
			}
		}

		if (now - this.lastEmitAt >= 200) {
			this.lastEmitAt = now;
			this.emitLive(now);
		}
		if (now - this.lastPulseAt >= PULSE_MS) {
			this.lastPulseAt = now;
			this.pulse();
		}
	}

	private measures(now: number) {
		const hasMic = this.pipeline?.has("mic") ?? false;
		const last = Math.max(this.lastVoice.mic, this.lastVoice.tab);
		const silenceMs = hasMic && last > 0 ? Math.max(0, now - last) : 0;
		// Live hoort één microfoon iedereen: de server meet je beurt uit de regels.
		const myStreakMs =
			this.snap.mode !== "live" &&
			this.streakStart &&
			now - this.lastVoice.mic < STREAK_GAP_MS
				? this.lastVoice.mic - this.streakStart
				: 0;
		return { silenceMs, myStreakMs };
	}

	private micOptions() {
		return {
			room: this.snap.mode === "live",
			gain: this.snap.micGain,
			deviceId: this.snap.micDevice || undefined,
		};
	}

	/** Versterking tijdens het gesprek; Speechmatics blijft gewoon verbonden. */
	setMicGain = (value: number) => {
		const gain = Math.min(6, Math.max(1, Math.round(value * 10) / 10));
		writeSetting(`${GAIN_KEY}.${this.snap.mode}`, String(gain));
		this.set({ micGain: gain });
		this.pipeline?.setMicGain(gain);
	};

	/** Andere microfoon (bv. een conferentiemicrofoon). */
	setMicDevice = async (deviceId: string) => {
		writeSetting(DEVICE_KEY, deviceId);
		this.set({ micDevice: deviceId });
		const pipeline = this.pipeline;
		if (!pipeline || !pipeline.has("mic")) return;
		try {
			await pipeline.switchMic(this.micOptions());
		} catch (error) {
			this.set({
				warning:
					error instanceof Error
						? error.message
						: "Microfoon wisselen mislukt.",
			});
		}
	};

	/** "Arin is niet iedereen": stem vergeten en opnieuw verbinden zonder. */
	resetVoice = async () => {
		const sessionId = this.snap.sessionId;
		if (!sessionId) return;
		await getConvexClient().mutation(api.coach.sessions.resetVoice, {
			sessionId,
		});
		const kind = this.transcriber?.kind;
		if (kind === "speechmatics") {
			const old = this.transcriber;
			this.transcriber = null;
			await old?.stop();
			this.startTranscriber(kind);
		}
	};

	private quietFrames: number[] = [];
	private lastClipAt = 0;

	private emitLive(now: number) {
		const levels = this.pipeline?.levels() ?? { mic: 0, tab: 0 };
		const meter = this.pipeline?.micMeter() ?? { rms: 0, peak: 0 };
		if (meter.peak >= 0.97) this.lastClipAt = now;
		this.set({
			now,
			levels,
			micPeak: meter.peak,
			micClip: now - this.lastClipAt < 1200,
			lowLevel: this.isLowLevel(),
			speaking: {
				mic: now - this.lastVoice.mic < 400,
				tab: now - this.lastVoice.tab < 400,
			},
			...this.measures(now),
		});
	}

	/** Al 30 s nauwelijks geluid (90% van de blokjes zachter dan spraak)? */
	private isLowLevel(): boolean {
		const q = this.quietFrames;
		if (this.snap.mode !== "live" || q.length < 300) return false;
		const sorted = [...q].sort((a, b) => a - b);
		return (sorted[Math.floor(sorted.length * 0.9)] ?? 0) < 0.015;
	}

	private pulse() {
		const sessionId = this.snap.sessionId;
		if (!sessionId || this.snap.phase !== "live") return;
		const { silenceMs, myStreakMs } = this.measures(Date.now());
		void getConvexClient()
			.mutation(api.coach.sessions.pulse, { sessionId, silenceMs, myStreakMs })
			.catch(() => {});
	}

	// ---- Screenshots -------------------------------------------------------------------

	private async sampleScreen() {
		const grabber = this.pipeline?.frameGrabber;
		if (!grabber || this.snap.shooting || this.snap.phase !== "live") return;
		const thumb = await grabber.thumbnail();
		if (!thumb) return;
		if (this.detector.push(thumb)) {
			await this.shoot(true).catch(() => {});
		}
	}

	takeShot = async () => {
		try {
			await this.shoot(false);
		} catch (error) {
			this.set({
				warning: error instanceof Error ? error.message : "Screenshot mislukt.",
			});
		}
	};

	private async shoot(auto: boolean) {
		const grabber = this.pipeline?.frameGrabber;
		const sessionId = this.snap.sessionId;
		if (!grabber || !sessionId) {
			throw new CaptureError("Deel eerst het Meet-tabblad voor screenshots.");
		}
		if (this.snap.shooting) return;
		this.set({ shooting: true });
		try {
			const at = Date.now();
			const blob = await grabber.capture();
			if (!auto) this.detector.markShot(await grabber.thumbnail(), at);
			const client = getConvexClient();
			const url = await client.mutation(
				api.coach.sessions.generateShotUploadUrl,
				{
					sessionId,
				},
			);
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": blob.type },
				body: blob,
			});
			if (!res.ok) throw new Error(`Upload mislukt (${res.status})`);
			const { storageId }: { storageId: Id<"_storage"> } = await res.json();
			await client.mutation(api.coach.sessions.addShot, {
				sessionId,
				storageId,
				at,
				auto,
			});
		} finally {
			this.set({ shooting: false });
		}
	}

	// ---- Tijdens het gesprek ---------------------------------------------------------------

	coachNow = () => {
		const sessionId = this.snap.sessionId;
		if (!sessionId) return;
		void getConvexClient()
			.mutation(api.coach.sessions.nudgeNow, { sessionId })
			.catch(() => {});
	};

	toggleMic = async () => {
		const pipeline = this.pipeline;
		if (!pipeline || this.snap.phase !== "live") return;
		const next = !pipeline.has("mic");
		try {
			await pipeline.setMic(next, this.micOptions());
		} catch (error) {
			this.set({
				warning: error instanceof Error ? error.message : "Microfoon mislukt.",
			});
			return;
		}
		this.set({ micOn: next });
		// Realtime: per bron een verbinding, dus opnieuw opbouwen.
		const kind = this.transcriber?.kind;
		if (kind === "speechmatics") {
			const old = this.transcriber;
			this.transcriber = null;
			await old?.stop();
			this.startTranscriber(kind);
		}
	};

	// ---- Zwevend venster -----------------------------------------------------------------------

	setPip(win: Window | null) {
		this.pipWindow = win;
		this.set({ pipOpen: !!win });
	}

	get pip(): Window | null {
		return this.pipWindow;
	}

	/** Kan door de PiP-module gezet worden; opent het venster automatisch. */
	autoPip: (() => void) | null = null;

	// ---- Luisteraars ----------------------------------------------------------------------------

	private installListeners() {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		this.teardown.push(() =>
			window.removeEventListener("beforeunload", onBeforeUnload),
		);

		const onKey = (event: KeyboardEvent) => {
			if (!event.altKey) return;
			if (event.code === "KeyS") {
				event.preventDefault();
				void this.takeShot();
			} else if (event.code === "KeyC") {
				event.preventDefault();
				this.coachNow();
			}
		};
		window.addEventListener("keydown", onKey);
		this.teardown.push(() => window.removeEventListener("keydown", onKey));

		// Chrome kan het zwevende venster zelf openen als je naar een ander
		// tabblad gaat (voor pagina's die de microfoon gebruiken).
		try {
			const setHandler = navigator.mediaSession.setActionHandler as (
				action: string,
				handler: (() => void) | null,
			) => void;
			setHandler.call(navigator.mediaSession, "enterpictureinpicture", () =>
				this.autoPip?.(),
			);
			this.teardown.push(() => {
				try {
					setHandler.call(
						navigator.mediaSession,
						"enterpictureinpicture",
						null,
					);
				} catch {
					// niet ondersteund
				}
			});
		} catch {
			// niet ondersteund
		}

		// Valt de audio weg (geen blokjes), dan houdt deze klok de UI levend.
		this.ticker = setInterval(() => {
			if (Date.now() - this.lastEmitAt > 900) this.emitLive(Date.now());
		}, 1000);
	}

	// ---- Stop ---------------------------------------------------------------------------------

	/** Laatste woorden afmaken, alles opslaan en het verslag laten maken. */
	async stop(): Promise<void> {
		if (this.snap.phase !== "live") return;
		const sessionId = this.snap.sessionId;
		this.set({ phase: "stopping" });
		try {
			await this.transcriber?.stop();
		} catch {
			// verder met afsluiten
		}
		this.transcriber = null;
		await Promise.allSettled([...this.inflight]);
		if (sessionId) {
			try {
				await getConvexClient().mutation(api.coach.sessions.stop, {
					sessionId,
				});
			} catch (error) {
				this.set({
					error:
						error instanceof Error
							? error.message
							: "Stoppen mislukt. Probeer opnieuw.",
					phase: "live",
				});
				return;
			}
		}
		await this.cleanup();
		this.set({ ...INITIAL, sessionId });
	}

	private async cleanup() {
		for (const fn of this.teardown.splice(0)) fn();
		if (this.ticker) clearInterval(this.ticker);
		this.ticker = null;
		this.pipWindow?.close();
		this.pipWindow = null;
		await this.pipeline?.close().catch(() => {});
		this.pipeline = null;
		this.detector = new SceneChangeDetector();
		this.lastVoice = { mic: 0, tab: 0 };
		this.streakStart = 0;
		this.lastPulseAt = 0;
		this.quietFrames = [];
	}
}

export const recorder = new CoachRecorder();
