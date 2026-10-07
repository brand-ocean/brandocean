// Audio voor de meeting coach. Twee bronnen, bewust apart gehouden:
// - "tab": het geluid van het gedeelde Meet-tabblad = de anderen. Meet speelt
//   je eigen stem niet af, dus hier zit Arin nooit in.
// - "mic": de eigen microfoon = Arin.
// Elke bron gaat door een eigen AudioWorklet naar 16 kHz, mono, 16-bit PCM in
// blokjes van 100 ms. Zo weet de coach zeker wie er praat, zonder te gokken
// op stemherkenning. Er wordt nooit iets afgespeeld.

export const PCM_SAMPLE_RATE = 16_000;
/** 100 ms per blokje. */
export const FRAME_SAMPLES = 1600;

export type Source = "tab" | "mic";

export type PcmFrame = {
	source: Source;
	pcm: Int16Array<ArrayBuffer>;
	/** RMS-niveau van het blokje, 0–1. */
	rms: number;
	/** Wandkloktijd (ms) van het einde van het blokje. */
	at: number;
};

const WORKLET = `
class Pcm16Processor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ratio = sampleRate / ${PCM_SAMPLE_RATE}
    this.phase = 0
    this.acc = 0
    this.cnt = 0
    this.buf = new Int16Array(${FRAME_SAMPLES})
    this.n = 0
    this.sq = 0
  }
  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channels = input.length
    const len = input[0].length
    for (let i = 0; i < len; i++) {
      let s = 0
      for (let c = 0; c < channels; c++) s += input[c][i]
      this.acc += s / channels
      this.cnt++
      this.phase += 1
      if (this.phase >= this.ratio) {
        this.phase -= this.ratio
        let v = this.acc / this.cnt
        this.acc = 0
        this.cnt = 0
        if (v > 1) v = 1
        else if (v < -1) v = -1
        this.sq += v * v
        this.buf[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff
        if (this.n === ${FRAME_SAMPLES}) {
          const rms = Math.sqrt(this.sq / ${FRAME_SAMPLES})
          this.port.postMessage({ pcm: this.buf.buffer, rms }, [this.buf.buffer])
          this.buf = new Int16Array(${FRAME_SAMPLES})
          this.n = 0
          this.sq = 0
        }
      }
    }
    return true
  }
}
registerProcessor("pcm16-processor", Pcm16Processor)
`;

export class CaptureError extends Error {}

type DisplayMediaOptions = DisplayMediaStreamOptions & {
	controller?: CaptureControllerLike;
	preferCurrentTab?: boolean;
	selfBrowserSurface?: "include" | "exclude";
	surfaceSwitching?: "include" | "exclude";
	systemAudio?: "include" | "exclude";
};

type CaptureControllerLike = {
	setFocusBehavior?: (
		behavior: "focus-captured-surface" | "no-focus-change",
	) => void;
};

type Branch = {
	stream: MediaStream;
	source: MediaStreamAudioSourceNode;
	node: AudioWorkletNode;
	analyser: AnalyserNode;
};

/**
 * Eén audiograaf per gesprek. `shareTab` moet vanuit een klik komen
 * (browsers vragen dan pas om een tabblad).
 */
export class AudioPipeline {
	private ctx: AudioContext | null = null;
	private branches: Partial<Record<Source, Branch>> = {};
	private tabStream: MediaStream | null = null;
	private frames: FrameGrabber | null = null;
	private listeners = new Set<(frame: PcmFrame) => void>();
	/** "Delen stoppen" in Chrome. */
	onTabEnded: (() => void) | null = null;

	private async context(): Promise<AudioContext> {
		if (this.ctx) return this.ctx;
		let ctx: AudioContext;
		try {
			ctx = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
		} catch {
			// Sommige browsers weigeren 16 kHz; de worklet sampelt dan zelf terug.
			ctx = new AudioContext();
		}
		const url = URL.createObjectURL(
			new Blob([WORKLET], { type: "application/javascript" }),
		);
		try {
			await ctx.audioWorklet.addModule(url);
		} finally {
			URL.revokeObjectURL(url);
		}
		if (ctx.state === "suspended") await ctx.resume();
		this.ctx = ctx;
		return ctx;
	}

	private async attach(source: Source, stream: MediaStream): Promise<void> {
		const ctx = await this.context();
		this.detach(source);
		const input = ctx.createMediaStreamSource(stream);
		const node = new AudioWorkletNode(ctx, "pcm16-processor", {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			channelCount: 1,
			channelCountMode: "explicit",
		});
		node.port.onmessage = (
			event: MessageEvent<{ pcm: ArrayBuffer; rms: number }>,
		) => {
			const frame: PcmFrame = {
				source,
				pcm: new Int16Array(event.data.pcm),
				rms: event.data.rms,
				at: Date.now(),
			};
			for (const listener of this.listeners) listener(frame);
		};
		const analyser = ctx.createAnalyser();
		analyser.fftSize = 512;
		const mute = ctx.createGain();
		mute.gain.value = 0;
		input.connect(node);
		input.connect(analyser);
		// Stil naar de uitgang, zodat de graaf blijft lopen. Nooit hoorbaar.
		node.connect(mute).connect(ctx.destination);
		this.branches[source] = { stream, source: input, node, analyser };
	}

	private detach(source: Source): void {
		const b = this.branches[source];
		if (!b) return;
		b.source.disconnect();
		b.node.port.onmessage = null;
		b.node.disconnect();
		b.analyser.disconnect();
		delete this.branches[source];
	}

	/** Vraagt om het Meet-tabblad te delen, met tabblad-audio. */
	async shareTab(): Promise<{ hasAudio: boolean }> {
		if (!navigator.mediaDevices?.getDisplayMedia) {
			throw new CaptureError(
				"Deze browser kan geen tabblad delen. Gebruik Chrome op een computer.",
			);
		}
		// AudioContext nu al maken: dit loopt nog binnen de klik.
		const ready = this.context();
		ready.catch(() => {});
		const Controller = (
			window as Window & { CaptureController?: new () => CaptureControllerLike }
		).CaptureController;
		const controller = Controller ? new Controller() : undefined;
		let stream: MediaStream;
		try {
			const options: DisplayMediaOptions = {
				// Chrome wil video om een tabblad te kunnen kiezen; die gebruiken
				// we voor screenshots. Lage framerate, scherp genoeg voor slides.
				video: {
					displaySurface: "browser",
					frameRate: { max: 5 },
					width: { max: 1920 },
					height: { max: 1080 },
				},
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
				},
				controller,
				preferCurrentTab: false,
				selfBrowserSurface: "exclude",
				surfaceSwitching: "include",
				systemAudio: "exclude",
			};
			stream = await navigator.mediaDevices.getDisplayMedia(options);
		} catch (error) {
			if (error instanceof DOMException && error.name === "NotAllowedError") {
				throw new CaptureError(
					"Delen geannuleerd. Klik opnieuw op Start en kies het Meet-tabblad.",
				);
			}
			throw new CaptureError("Tabblad delen mislukt.");
		}
		// Blijf op de coachpagina, zodat je het zwevende venster kunt openen.
		try {
			controller?.setFocusBehavior?.("no-focus-change");
		} catch {
			// Niet elke Chrome-versie kent dit; dan springt hij naar Meet.
		}
		await ready;
		this.stopTab();
		this.tabStream = stream;
		const video = stream.getVideoTracks()[0];
		this.frames = video ? new FrameGrabber(video) : null;
		const audio = stream.getAudioTracks()[0];
		const endedOn = audio ?? video;
		endedOn?.addEventListener("ended", () => {
			if (this.tabStream !== stream) return;
			this.stopTab();
			this.onTabEnded?.();
		});
		if (audio) await this.attach("tab", new MediaStream([audio]));
		return { hasAudio: !!audio };
	}

	stopTab(): void {
		this.frames?.dispose();
		this.frames = null;
		this.detach("tab");
		for (const track of this.tabStream?.getTracks() ?? []) track.stop();
		this.tabStream = null;
	}

	/** Eigen microfoon aan of uit. */
	async setMic(on: boolean): Promise<void> {
		if (!on) {
			const b = this.branches.mic;
			this.detach("mic");
			for (const track of b?.stream.getTracks() ?? []) track.stop();
			return;
		}
		if (this.branches.mic) return;
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					// Echo-onderdrukking helpt als je toch zonder koptelefoon zit.
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === "NotAllowedError") {
				throw new CaptureError(
					"Geen toegang tot de microfoon. Sta hem toe via het slotje in de adresbalk.",
				);
			}
			throw new CaptureError("Microfoon starten mislukt.");
		}
		await this.attach("mic", stream);
	}

	has(source: Source): boolean {
		return !!this.branches[source];
	}

	get sharing(): boolean {
		return this.tabStream !== null;
	}

	get frameGrabber(): FrameGrabber | null {
		return this.frames;
	}

	/** Niveaus 0–1 voor de meters. */
	levels(): Record<Source, number> {
		const read = (b: Branch | undefined) => {
			if (!b) return 0;
			const data = new Float32Array(b.analyser.fftSize);
			b.analyser.getFloatTimeDomainData(data);
			let sum = 0;
			for (const v of data) sum += v * v;
			return Math.sqrt(sum / data.length);
		};
		return { tab: read(this.branches.tab), mic: read(this.branches.mic) };
	}

	subscribe(listener: (frame: PcmFrame) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	async close(): Promise<void> {
		this.stopTab();
		await this.setMic(false);
		this.listeners.clear();
		const ctx = this.ctx;
		this.ctx = null;
		if (ctx && ctx.state !== "closed") await ctx.close();
	}
}

/** Plakt PCM-blokjes aan elkaar met een WAV-header ervoor. */
export function encodeWav(frames: readonly Int16Array[]): ArrayBuffer {
	const samples = frames.reduce((n, f) => n + f.length, 0);
	const buffer = new ArrayBuffer(44 + samples * 2);
	const view = new DataView(buffer);
	const write = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++) {
			view.setUint8(offset + i, text.charCodeAt(i));
		}
	};
	write(0, "RIFF");
	view.setUint32(4, 36 + samples * 2, true);
	write(8, "WAVE");
	write(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, PCM_SAMPLE_RATE, true);
	view.setUint32(28, PCM_SAMPLE_RATE * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	write(36, "data");
	view.setUint32(40, samples * 2, true);
	const out = new Int16Array(buffer, 44);
	let offset = 0;
	for (const frame of frames) {
		out.set(frame, offset);
		offset += frame.length;
	}
	return buffer;
}

// ---- Screenshots ---------------------------------------------------------------

export const THUMB_W = 64;
export const THUMB_H = 36;

/**
 * Leest frames uit de videotrack van het gedeelde tabblad. Een verborgen
 * <video> houdt het laatste frame vast, ook als het scherm stilstaat.
 */
export class FrameGrabber {
	private video: HTMLVideoElement;
	private thumbCanvas: HTMLCanvasElement;

	constructor(private readonly track: MediaStreamTrack) {
		const video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		video.srcObject = new MediaStream([track]);
		video.style.cssText =
			"position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
		document.body.appendChild(video);
		void video.play().catch(() => {});
		this.video = video;
		this.thumbCanvas = document.createElement("canvas");
		this.thumbCanvas.width = THUMB_W;
		this.thumbCanvas.height = THUMB_H;
	}

	get live(): boolean {
		return this.track.readyState === "live";
	}

	private videoReady(): boolean {
		return this.video.readyState >= 2 && this.video.videoWidth > 0;
	}

	/**
	 * Het huidige beeld. Staat dit tabblad op de achtergrond (meestal: je zit
	 * in Meet), dan ververst Chrome de verborgen <video> niet altijd; dan
	 * vragen we het volgende frame op via ImageCapture. Komt er binnen 1,5 s
	 * geen frame, dan staat het scherm stil en is er niets nieuws.
	 */
	private async frame(): Promise<{
		image: CanvasImageSource;
		width: number;
		height: number;
		close?: () => void;
	} | null> {
		// grabFrame staat (nog) niet in de DOM-typen van TypeScript.
		const Capture:
			| (new (
					track: MediaStreamTrack,
			  ) => {
					grabFrame(): Promise<ImageBitmap>;
			  })
			| null =
			"ImageCapture" in window
				? (window.ImageCapture as new (
						track: MediaStreamTrack,
					) => ImageCapture & { grabFrame(): Promise<ImageBitmap> })
				: null;
		if ((document.hidden || !this.videoReady()) && Capture && this.live) {
			try {
				const bitmap = await Promise.race([
					new Capture(this.track).grabFrame(),
					new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
				]);
				if (bitmap) {
					return {
						image: bitmap,
						width: bitmap.width,
						height: bitmap.height,
						close: () => bitmap.close(),
					};
				}
			} catch {
				// val terug op de video
			}
		}
		if (!this.videoReady()) return null;
		const v = this.video;
		return { image: v, width: v.videoWidth, height: v.videoHeight };
	}

	/** Huidig frame als JPEG, hooguit `maxWidth` breed. */
	async capture(maxWidth = 1600, quality = 0.8): Promise<Blob> {
		const src = await this.frame();
		if (!src) {
			throw new CaptureError("Nog geen beeld van het gedeelde tabblad.");
		}
		const scale = Math.min(1, maxWidth / src.width);
		const canvas = document.createElement("canvas");
		canvas.width = Math.round(src.width * scale);
		canvas.height = Math.round(src.height * scale);
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new CaptureError("Screenshot maken mislukt.");
		ctx.drawImage(src.image, 0, 0, canvas.width, canvas.height);
		src.close?.();
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/jpeg", quality),
		);
		if (!blob) throw new CaptureError("Screenshot maken mislukt.");
		return blob;
	}

	/** Klein grijswaardenplaatje (64×36) om schermwissels te herkennen. */
	async thumbnail(): Promise<Uint8Array | null> {
		const src = await this.frame();
		if (!src) return null;
		const ctx = this.thumbCanvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return null;
		ctx.drawImage(src.image, 0, 0, THUMB_W, THUMB_H);
		src.close?.();
		const rgba = ctx.getImageData(0, 0, THUMB_W, THUMB_H).data;
		const gray = new Uint8Array(THUMB_W * THUMB_H);
		for (let i = 0; i < gray.length; i++) {
			const o = i * 4;
			gray[i] =
				((rgba[o] ?? 0) * 77 +
					(rgba[o + 1] ?? 0) * 150 +
					(rgba[o + 2] ?? 0) * 29) >>
				8;
		}
		return gray;
	}

	dispose(): void {
		this.video.pause();
		this.video.srcObject = null;
		this.video.remove();
	}
}

/** Gemiddeld absoluut verschil per pixel (0–255). */
export function thumbDiff(a: Uint8Array, b: Uint8Array): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
	return sum / a.length;
}

/**
 * Herkent een nieuw scherm: duidelijk anders dan het laatst vastgelegde, en
 * twee opeenvolgende samples (±1 s uit elkaar) bijna gelijk, dus stilstaand
 * (geen video). Stilstaand moet het ±2 s blijven. Hooguit één per 20 s.
 */
export class SceneChangeDetector {
	static CHANGE = 14;
	static STABLE = 5;
	static STABLE_SAMPLES = 2;
	static MIN_INTERVAL_MS = 20_000;

	private baseline: Uint8Array | null = null;
	private previous: Uint8Array | null = null;
	private stableCount = 0;
	private lastShotAt = 0;

	push(sample: Uint8Array, now = Date.now()): boolean {
		const prev = this.previous;
		this.previous = sample;
		if (!this.baseline) {
			this.baseline = sample;
			return false;
		}
		if (!prev) return false;
		this.stableCount =
			thumbDiff(sample, prev) < SceneChangeDetector.STABLE
				? this.stableCount + 1
				: 0;
		const changed =
			thumbDiff(sample, this.baseline) > SceneChangeDetector.CHANGE;
		if (
			changed &&
			this.stableCount >= SceneChangeDetector.STABLE_SAMPLES &&
			now - this.lastShotAt >= SceneChangeDetector.MIN_INTERVAL_MS
		) {
			this.markShot(sample, now);
			return true;
		}
		return false;
	}

	markShot(sample: Uint8Array | null, now = Date.now()): void {
		if (sample) this.baseline = sample;
		this.lastShotAt = now;
		this.stableCount = 0;
	}
}
