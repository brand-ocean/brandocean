export const MOBILE_BREAKPOINT = 1000;

const LENIS_EASING = (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t));

const LENIS_SHARED = {
	easing: LENIS_EASING,
	direction: "vertical",
	gestureDirection: "vertical",
	smooth: true,
	infinite: false,
	wheelMultiplier: 1,
	orientation: "vertical",
	smoothWheel: true,
	syncTouch: true,
} as const;

export const LENIS_MOBILE = {
	...LENIS_SHARED,
	duration: 0.8,
	smoothTouch: true,
	touchMultiplier: 1.5,
	lerp: 0.09,
};

export const LENIS_DESKTOP = {
	...LENIS_SHARED,
	duration: 1.2,
	smoothTouch: false,
	touchMultiplier: 2,
	lerp: 0.1,
};
