import { type RefObject, useEffect } from "react";
import * as THREE from "three";
import {
	renderFragmentShader,
	renderVertexShader,
	simulationFragmentShader,
	simulationVertexShader,
} from "./gentleRainShaders";

type GentleRainOptions = {
	canvasRef: RefObject<HTMLCanvasElement | null>;
	containerRef: RefObject<HTMLElement | null>;
	imageSrc: string;
	enabled: boolean;
};

export function useGentleRain({
	canvasRef,
	containerRef,
	imageSrc,
	enabled,
}: GentleRainOptions) {
	useEffect(() => {
		if (!enabled) return;

		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container) return;

		const scene = new THREE.Scene();
		const simScene = new THREE.Scene();
		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
			preserveDrawingBuffer: true,
		});

		const mouse = new THREE.Vector2(0, 0);
		let frame = 0;
		let animationId = 0;
		let disposed = false;

		const getBufferSize = () => {
			const dpr = Math.min(window.devicePixelRatio, 2);
			const w = Math.max(1, Math.floor(container.clientWidth * dpr));
			const h = Math.max(1, Math.floor(container.clientHeight * dpr));
			return { w, h, dpr };
		};

		let { w: bufferW, h: bufferH, dpr } = getBufferSize();

		const rtOptions: THREE.RenderTargetOptions = {
			format: THREE.RGBAFormat,
			type: THREE.FloatType,
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			stencilBuffer: false,
			depthBuffer: false,
		};

		let rtA = new THREE.WebGLRenderTarget(bufferW, bufferH, rtOptions);
		let rtB = new THREE.WebGLRenderTarget(bufferW, bufferH, rtOptions);

		const simMaterial = new THREE.ShaderMaterial({
			uniforms: {
				textureA: { value: null as THREE.Texture | null },
				mouse: { value: mouse },
				resolution: { value: new THREE.Vector2(bufferW, bufferH) },
				time: { value: 0 },
				frame: { value: 0 },
			},
			vertexShader: simulationVertexShader,
			fragmentShader: simulationFragmentShader,
		});

		const renderMaterial = new THREE.ShaderMaterial({
			uniforms: {
				textureA: { value: null as THREE.Texture | null },
				textureB: { value: null as THREE.Texture | null },
			},
			vertexShader: renderVertexShader,
			fragmentShader: renderFragmentShader,
			transparent: true,
		});

		const plane = new THREE.PlaneGeometry(2, 2);
		const simQuad = new THREE.Mesh(plane, simMaterial);
		const renderQuad = new THREE.Mesh(plane, renderMaterial);
		simScene.add(simQuad);
		scene.add(renderQuad);

		const textureLoader = new THREE.TextureLoader();
		let imageTexture: THREE.Texture | null = null;

		const applyDisplaySize = () => {
			const cssW = container.clientWidth;
			const cssH = container.clientHeight;
			renderer.setSize(cssW, cssH, false);
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		};

		const applyBufferSize = () => {
			const size = getBufferSize();
			bufferW = size.w;
			bufferH = size.h;
			dpr = size.dpr;
			rtA.setSize(bufferW, bufferH);
			rtB.setSize(bufferW, bufferH);
			simMaterial.uniforms.resolution.value.set(bufferW, bufferH);
		};

		const resize = () => {
			applyDisplaySize();
			applyBufferSize();
		};

		const setPointer = (clientX: number, clientY: number) => {
			const rect = container.getBoundingClientRect();
			mouse.x = (clientX - rect.left) * dpr;
			mouse.y = (rect.bottom - clientY) * dpr;
		};

		const clearPointer = () => {
			mouse.set(0, 0);
		};

		const onPointerMove = (e: PointerEvent) => {
			setPointer(e.clientX, e.clientY);
		};

		const onPointerLeave = () => {
			clearPointer();
		};

		const onTouchMove = (e: TouchEvent) => {
			if (e.touches.length === 0) return;
			const t = e.touches[0];
			setPointer(t.clientX, t.clientY);
		};

		applyDisplaySize();
		applyBufferSize();

		textureLoader.load(
			imageSrc,
			(texture) => {
				if (disposed) {
					texture.dispose();
					return;
				}
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.minFilter = THREE.LinearFilter;
				texture.magFilter = THREE.LinearFilter;
				imageTexture = texture;
				renderMaterial.uniforms.textureB.value = texture;
			},
			undefined,
			() => {
				// Keep sim running; render pass skips until texture loads
			},
		);

		const animate = () => {
			if (disposed) return;

			simMaterial.uniforms.frame.value = frame++;
			simMaterial.uniforms.time.value = performance.now() / 1000;

			simMaterial.uniforms.textureA.value = rtA.texture;
			renderer.setRenderTarget(rtB);
			renderer.render(simScene, camera);

			if (imageTexture) {
				renderMaterial.uniforms.textureA.value = rtB.texture;
				renderer.setRenderTarget(null);
				renderer.render(scene, camera);
			}

			const temp = rtA;
			rtA = rtB;
			rtB = temp;

			animationId = requestAnimationFrame(animate);
		};

		animate();

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(container);
		window.addEventListener("resize", resize);
		container.addEventListener("pointermove", onPointerMove);
		container.addEventListener("pointerleave", onPointerLeave);
		container.addEventListener("touchmove", onTouchMove, { passive: true });
		container.addEventListener("touchend", clearPointer);

		return () => {
			disposed = true;
			cancelAnimationFrame(animationId);
			resizeObserver.disconnect();
			window.removeEventListener("resize", resize);
			container.removeEventListener("pointermove", onPointerMove);
			container.removeEventListener("pointerleave", onPointerLeave);
			container.removeEventListener("touchmove", onTouchMove);
			container.removeEventListener("touchend", clearPointer);

			plane.dispose();
			simMaterial.dispose();
			renderMaterial.dispose();
			rtA.dispose();
			rtB.dispose();
			imageTexture?.dispose();
			renderer.dispose();
		};
	}, [canvasRef, containerRef, imageSrc, enabled]);
}
