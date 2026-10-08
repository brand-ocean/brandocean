import type { AudioPipeline, PcmFrame, Source } from "./audio";
import { encodeWav, PCM_SAMPLE_RATE } from "./audio";

// Transcriptie voor de coach, twee varianten:
// - Speechmatics realtime: per bron een eigen WebSocket. Microfoon = jij
//   (geen sprekerherkenning nodig), tabblad = de anderen (met
//   sprekerherkenning: S1, S2, …). Regels zijn er binnen ±2 s.
// - Gateway: stukken van ±15 s (beide bronnen samen in één aanroep) naar
//   Convex; Gemini 3.8 Flash schrijft ze uit en de server bewaart de regels.
//   Werkt zonder extra sleutels, met ±15–20 s vertraging.

export type FinalLine = {
	source: Source;
	speaker: string | null;
	text: string;
	at: number;
	durationMs?: number;
};

export type StreamStatus =
	| "connecting"
	| "listening"
	| "reconnecting"
	| "stopped"
	| "error";

export type TranscriptionHandlers = {
	onFinal: (line: FinalLine) => void;
	onInterim: (source: Source, text: string) => void;
	onStatus: (
		source: Source | "all",
		status: StreamStatus,
		message?: string,
	) => void;
	onPending?: (count: number) => void;
	onWarning?: (message: string) => void;
	/** Stemkenmerken per sprekerlabel (Speechmatics, live). */
	onSpeakers?: (speakers: { label: string; identifiers: string[] }[]) => void;
};

export interface Transcriber {
	readonly kind: "speechmatics" | "gateway";
	start(audio: AudioPipeline, handlers: TranscriptionHandlers): void;
	stop(): Promise<void>;
}

// ---- Speechmatics ----------------------------------------------------------------

// https://docs.speechmatics.com/api-ref/realtime-transcription-websocket
const SPEECHMATICS_URL = "wss://eu.rt.speechmatics.com/v2";
const MAX_RETRIES = 6;

type SmResult = {
	type: "word" | "punctuation" | "entity";
	start_time: number;
	end_time: number;
	attaches_to?: "next" | "previous" | "none" | "both";
	alternatives?: { content: string; speaker?: string }[];
};
type SmMessage =
	| { message: "RecognitionStarted" }
	| { message: "AudioAdded"; seq_no: number }
	| { message: "AddTranscript" | "AddPartialTranscript"; results: SmResult[] }
	| { message: "EndOfTranscript" }
	| { message: "Error"; type: string; reason: string }
	| { message: "Warning" | "Info"; type: string; reason: string }
	| {
			message: "SpeakersResult";
			speakers: { label: string; speaker_identifiers: string[] }[];
	  };

export type KnownSpeaker = { label: string; speaker_identifiers: string[] };
export type SpeechmaticsSession = { token: string; speakers: KnownSpeaker[] };

function joinTokens(results: readonly SmResult[]): string {
	let text = "";
	for (const r of results) {
		const content = r.alternatives?.[0]?.content ?? "";
		if (!content) continue;
		const glue = r.attaches_to === "previous" || r.attaches_to === "both";
		text += text && !glue ? ` ${content}` : content;
	}
	return text;
}

const speakerOf = (r: SmResult): string | null => {
	const s = r.alternatives?.[0]?.speaker;
	return s && s !== "UU" ? s : null;
};

/** Eén realtime-verbinding voor één bron. */
class SpeechmaticsStream {
	private ws: WebSocket | null = null;
	private started = false;
	private stopping = false;
	private fatal = false;
	private seq = 0;
	private origin = 0;
	private backlog: Int16Array<ArrayBuffer>[] = [];
	private line: { speaker: string | null; results: SmResult[] } | null = null;
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private retries = 0;
	private unsubscribe: (() => void) | null = null;
	private framesSinceSpeakers = 0;
	/** Bekende stemmen meesturen; uit na een weigering, dan gewoon zonder. */
	private useKnown = true;
	private sentKnown = false;

	constructor(
		private readonly source: Source,
		private readonly getSession: () => Promise<SpeechmaticsSession>,
		private readonly vocab: readonly string[],
		private readonly handlers: TranscriptionHandlers,
		private readonly onFatal: (message: string) => void,
		/** Meerdere stemmen op deze bron (tabblad, of live de enige microfoon). */
		private readonly diarize: boolean,
	) {}

	/** Vraag nu de stemkenmerken op (bijv. net na "Dit ben ik"). */
	requestSpeakers() {
		const ws = this.ws;
		if (
			this.diarize &&
			ws &&
			this.started &&
			ws.readyState === WebSocket.OPEN
		) {
			ws.send(JSON.stringify({ message: "GetSpeakers" }));
			this.framesSinceSpeakers = 0;
		}
	}

	start(audio: AudioPipeline) {
		this.unsubscribe = audio.subscribe((frame) => {
			if (frame.source === this.source) this.onFrame(frame);
		});
		void this.connect("connecting");
	}

	private onFrame(frame: PcmFrame) {
		const ws = this.ws;
		if (ws && this.started && ws.readyState === WebSocket.OPEN) {
			ws.send(frame.pcm);
			this.seq++;
			// Om de ±45 s de stemkenmerken ophalen, zodat je stem onthouden wordt.
			if (++this.framesSinceSpeakers >= 450) this.requestSpeakers();
			return;
		}
		// Tijdens (her)verbinden hooguit 10 s bewaren.
		this.backlog.push(frame.pcm);
		if (this.backlog.length > 100) this.backlog.shift();
	}

	private async connect(status: StreamStatus) {
		this.handlers.onStatus(this.source, status);
		let token: string;
		let known: KnownSpeaker[] = [];
		try {
			// Vers per verbinding: de sleutel leeft 120 s, een open verbinding
			// blijft daarna gewoon lopen.
			const session = await this.getSession();
			token = session.token;
			known = this.useKnown ? session.speakers : [];
			this.sentKnown = known.length > 0;
		} catch (error) {
			this.fatal = true;
			this.onFatal(
				error instanceof Error
					? error.message
					: "Speechmatics-sleutel ophalen mislukt.",
			);
			return;
		}
		if (this.stopping) return;
		const ws = new WebSocket(
			`${SPEECHMATICS_URL}?jwt=${encodeURIComponent(token)}`,
		);
		ws.binaryType = "arraybuffer";
		this.ws = ws;
		this.started = false;
		this.seq = 0;
		ws.onopen = () => {
			ws.send(
				JSON.stringify({
					message: "StartRecognition",
					audio_format: {
						type: "raw",
						encoding: "pcm_s16le",
						sample_rate: PCM_SAMPLE_RATE,
					},
					transcription_config: {
						language: "nl",
						model: "enhanced",
						// Online: microfoon = altijd jij, het tabblad heeft meerdere
						// stemmen. Live: één microfoon voor iedereen, en bekende stemmen
						// (jij) krijgen meteen hun naam als label.
						diarization: this.diarize ? "speaker" : "none",
						...(this.diarize
							? {
									speaker_diarization_config: {
										// Hoger = sneller een nieuwe stem i.p.v. een bekende. Met een
										// opgeslagen stem extra voorzichtig, zodat niet iedereen
										// "Arin" wordt.
										speaker_sensitivity: known.length ? 0.75 : 0.6,
										prefer_current_speaker: false,
										get_speakers: true,
										...(known.length ? { speakers: known } : {}),
									},
								}
							: {}),
						enable_partials: true,
						max_delay: 2,
						additional_vocab: this.vocab.map((content) => ({ content })),
					},
				}),
			);
		};
		ws.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
			if (typeof event.data !== "string") return;
			const message: SmMessage = JSON.parse(event.data);
			this.onMessage(message);
		};
		ws.onclose = (event) => {
			if (this.ws !== ws) return;
			this.ws = null;
			this.started = false;
			this.flushLine();
			if (this.stopping || this.fatal) return;
			if (this.retries < MAX_RETRIES) {
				this.retries++;
				this.handlers.onStatus(this.source, "reconnecting");
				setTimeout(
					() => void this.connect("reconnecting"),
					Math.min(8000, 800 * 2 ** (this.retries - 1)),
				);
			} else {
				this.fatal = true;
				this.onFatal(
					`Verbinding met Speechmatics verbroken (${event.code}${event.reason ? `: ${event.reason}` : ""}).`,
				);
			}
		};
	}

	private onMessage(m: SmMessage) {
		switch (m.message) {
			case "RecognitionStarted": {
				this.started = true;
				this.retries = 0;
				this.origin = Date.now() - this.backlog.length * 100;
				for (const pcm of this.backlog) {
					this.ws?.send(pcm);
					this.seq++;
				}
				this.backlog = [];
				this.handlers.onStatus(this.source, "listening");
				break;
			}
			case "AddTranscript":
				this.addFinal(m.results);
				break;
			case "AddPartialTranscript":
				this.emitInterim(m.results);
				break;
			case "SpeakersResult":
				this.handlers.onSpeakers?.(
					m.speakers.map((sp) => ({
						label: sp.label,
						identifiers: sp.speaker_identifiers,
					})),
				);
				break;
			case "Error": {
				// Oude of ongeldige stemkenmerken: opnieuw verbinden zonder.
				if (!this.started && this.sentKnown && m.type !== "not_authorised") {
					this.useKnown = false;
					this.handlers.onWarning?.(
						"Je opgeslagen stem werd niet geaccepteerd. Tik opnieuw op 'dit ben ik'.",
					);
					this.ws?.close();
					break;
				}
				const message =
					m.type === "not_authorised"
						? "Speechmatics weigert de sleutel. Controleer SPEECHMATICS_API_KEY."
						: m.type === "quota_exceeded"
							? "Speechmatics: limiet bereikt (te veel sessies of tegoed op)."
							: `Speechmatics-fout: ${m.reason}`;
				if (m.type !== "quota_exceeded" && m.type !== "job_error") {
					this.fatal = true;
					this.onFatal(message);
				} else {
					this.handlers.onWarning?.(message);
				}
				break;
			}
			default:
				break;
		}
	}

	private addFinal(results: readonly SmResult[]) {
		for (const r of results) {
			const speaker = r.type === "punctuation" ? null : speakerOf(r);
			if (
				this.line &&
				r.type !== "punctuation" &&
				speaker !== this.line.speaker &&
				this.line.results.length > 0
			) {
				this.flushLine();
			}
			if (!this.line) {
				if (r.type === "punctuation") continue;
				this.line = { speaker, results: [] };
			}
			this.line.results.push(r);
			const last = r.alternatives?.[0]?.content ?? "";
			if (
				r.type === "punctuation" &&
				/[.?!]/.test(last) &&
				joinTokens(this.line.results).length > 200
			) {
				this.flushLine();
			}
		}
		if (this.flushTimer) clearTimeout(this.flushTimer);
		// 1,5 s pauze sluit de regel af: snel genoeg voor de coach.
		this.flushTimer = setTimeout(() => this.flushLine(), 1500);
		this.emitInterim([]);
	}

	private emitInterim(partial: readonly SmResult[]) {
		const pending = this.line ? joinTokens(this.line.results) : "";
		const extra = joinTokens(partial);
		this.handlers.onInterim(
			this.source,
			[pending, extra].filter(Boolean).join(" "),
		);
	}

	private flushLine() {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
		const line = this.line;
		this.line = null;
		if (!line) return;
		const text = joinTokens(line.results).trim();
		if (!text) return;
		const first = line.results[0];
		const last = line.results[line.results.length - 1];
		this.handlers.onFinal({
			source: this.source,
			speaker: this.diarize ? line.speaker : null,
			text,
			at: first
				? Math.round(this.origin + first.start_time * 1000)
				: Date.now(),
			durationMs:
				first && last
					? Math.max(300, Math.round((last.end_time - first.start_time) * 1000))
					: undefined,
		});
		this.handlers.onInterim(this.source, "");
	}

	async stop() {
		this.stopping = true;
		this.unsubscribe?.();
		this.unsubscribe = null;
		const ws = this.ws;
		if (ws && ws.readyState === WebSocket.OPEN && this.started) {
			// Laat Speechmatics de laatste woorden afmaken (max 4 s).
			await new Promise<void>((resolve) => {
				const timer = setTimeout(resolve, 4000);
				ws.addEventListener(
					"message",
					(event: MessageEvent<string | ArrayBuffer>) => {
						if (
							typeof event.data === "string" &&
							event.data.includes('"EndOfTranscript"')
						) {
							clearTimeout(timer);
							resolve();
						}
					},
				);
				ws.send(
					JSON.stringify({ message: "EndOfStream", last_seq_no: this.seq }),
				);
			});
		}
		this.flushLine();
		this.ws = null;
		ws?.close();
	}
}

export class SpeechmaticsTranscriber implements Transcriber {
	readonly kind = "speechmatics" as const;
	private streams: SpeechmaticsStream[] = [];

	constructor(
		private readonly getSession: () => Promise<SpeechmaticsSession>,
		private readonly vocab: readonly string[],
		/** Wordt één keer aangeroepen als realtime niet werkt (sleutel, tegoed). */
		private readonly onFatal: (message: string) => void,
		/** Live: alleen de microfoon, met sprekerherkenning. */
		private readonly live = false,
	) {}

	requestSpeakers() {
		for (const s of this.streams) s.requestSpeakers();
	}

	start(audio: AudioPipeline, handlers: TranscriptionHandlers) {
		let failed = false;
		const fatal = (message: string) => {
			if (failed) return;
			failed = true;
			this.onFatal(message);
		};
		for (const source of ["mic", "tab"] as const) {
			if (!audio.has(source)) continue;
			const stream = new SpeechmaticsStream(
				source,
				this.getSession,
				this.vocab,
				handlers,
				fatal,
				source === "tab" || this.live,
			);
			this.streams.push(stream);
			stream.start(audio);
		}
	}

	async stop() {
		const streams = this.streams;
		this.streams = [];
		await Promise.all(streams.map((s) => s.stop()));
	}
}

// ---- Gateway (Gemini via Convex) ---------------------------------------------------

const SILENCE_RMS = 0.006;
const SPEECH_RMS = 0.012;
const MIN_SEGMENT_MS = 12_000;
const MAX_SEGMENT_MS = 20_000;
const QUIET_TAIL_MS = 400;

export type UploadSegment = (segment: {
	mic?: ArrayBuffer;
	tab?: ArrayBuffer;
	startedAt: number;
	durationMs: number;
}) => Promise<void>;

type Buffer = {
	frames: Int16Array<ArrayBuffer>[];
	peak: number;
	loudAt: number;
};

export class GatewayTranscriber implements Transcriber {
	readonly kind = "gateway" as const;
	private unsubscribe: (() => void) | null = null;
	private handlers: TranscriptionHandlers | null = null;
	private buf: Record<Source, Buffer> = {
		mic: { frames: [], peak: 0, loudAt: 0 },
		tab: { frames: [], peak: 0, loudAt: 0 },
	};
	private startedAt = 0;
	private queue: Promise<void> = Promise.resolve();
	private pending = 0;

	constructor(private readonly upload: UploadSegment) {}

	start(audio: AudioPipeline, handlers: TranscriptionHandlers) {
		this.handlers = handlers;
		this.unsubscribe = audio.subscribe((frame) => this.onFrame(frame));
		handlers.onStatus("all", "listening");
	}

	private onFrame(frame: PcmFrame) {
		const b = this.buf[frame.source];
		if (this.startedAt === 0) this.startedAt = frame.at - 100;
		b.frames.push(frame.pcm);
		b.peak = Math.max(b.peak, frame.rms);
		if (frame.rms >= SILENCE_RMS) b.loudAt = frame.at;
		const elapsed = frame.at - this.startedAt;
		const quiet =
			frame.at - this.buf.mic.loudAt >= QUIET_TAIL_MS &&
			frame.at - this.buf.tab.loudAt >= QUIET_TAIL_MS;
		// Knip bij voorkeur in een stilte, en uiterlijk na 20 s.
		if ((elapsed >= MIN_SEGMENT_MS && quiet) || elapsed >= MAX_SEGMENT_MS) {
			this.cut(frame.at);
		}
	}

	private cut(now: number) {
		const { mic, tab } = this.buf;
		const startedAt = this.startedAt;
		const send = {
			mic: mic.peak >= SPEECH_RMS ? encodeWav(mic.frames) : undefined,
			tab: tab.peak >= SPEECH_RMS ? encodeWav(tab.frames) : undefined,
		};
		this.buf = {
			mic: { frames: [], peak: 0, loudAt: mic.loudAt },
			tab: { frames: [], peak: 0, loudAt: tab.loudAt },
		};
		this.startedAt = 0;
		if (!send.mic && !send.tab) return;
		const durationMs = Math.max(1000, now - startedAt);
		this.setPending(this.pending + 1);
		// Op volgorde: elk stuk krijgt de vorige regels als context.
		this.queue = this.queue
			.then(() => this.upload({ ...send, startedAt, durationMs }))
			.catch((error: Error) => {
				this.handlers?.onWarning?.(
					`Een stukje gesprek kon niet worden uitgeschreven: ${error.message}`,
				);
			})
			.finally(() => this.setPending(this.pending - 1));
	}

	private setPending(count: number) {
		this.pending = count;
		this.handlers?.onPending?.(count);
	}

	async stop() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		if (this.startedAt) this.cut(Date.now());
		await this.queue;
	}
}
