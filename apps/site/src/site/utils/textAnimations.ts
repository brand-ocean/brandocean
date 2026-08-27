import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

// GSAP's ticker schiet een requestAnimationFrame in zodra een plugin zich
// registreert, en workerd verbiedt timers op module-scope — dat liet de
// SSR-boundary knappen. Registreren hoeft alleen in de browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(SplitText);
}

const DESKTOP_MIN = 1200;

let splitInstances: SplitText[] = [];

function getTextContent(element: Element) {
	return element.textContent || (element as HTMLElement).innerText || "";
}

function isDesktop() {
	return window.innerWidth >= DESKTOP_MIN;
}

export function scrambleText(elements: Element[], duration = 0.4) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";

	elements.forEach((char) => {
		// Icons (e.g. SVG arrows) can't scramble glyphs — reveal with the stagger
		if (char.tagName === "svg" || char.tagName === "SVG") {
			gsap.fromTo(
				char,
				{ opacity: 0 },
				{
					opacity: 1,
					duration: duration * 0.5,
					ease: "power2.out",
				},
			);
			return;
		}

		const originalText = char.textContent;
		let iterations = 0;
		const maxIterations = Math.floor(Math.random() * 6) + 3;

		gsap.set(char, { opacity: 1 });

		const scrambleInterval = setInterval(() => {
			char.textContent = chars[Math.floor(Math.random() * chars.length)];
			iterations++;

			if (iterations >= maxIterations) {
				clearInterval(scrambleInterval);
				char.textContent = originalText;
			}
		}, 50);

		setTimeout(() => {
			clearInterval(scrambleInterval);
			char.textContent = originalText;
		}, duration * 1000);
	});
}

export function scrambleTextStaggered(elements: Element[], duration = 0.4) {
	elements.forEach((char, index) => {
		setTimeout(() => {
			scrambleText([char], duration);
		}, index * 30);
	});
}

export function scrambleAnimation(element: Element, delay = 0) {
	const textContent = getTextContent(element);
	if (!textContent.trim()) return null;

	const split = SplitText.create(element, {
		type: "chars",
	});

	splitInstances.push(split);

	gsap.set(split.chars, {
		opacity: 0,
	});

	setTimeout(() => {
		scrambleTextStaggered(split.chars, 0.4);
	}, delay * 1000);

	return split;
}

export function revealAnimation(element: Element, delay = 0) {
	const textContent = getTextContent(element);
	if (!textContent.trim()) return null;

	const split = SplitText.create(element, {
		type: "words",
		mask: "words",
	});

	splitInstances.push(split);

	gsap.set(split.words, {
		yPercent: 120,
	});

	gsap.to(split.words, {
		duration: 0.75,
		yPercent: 0,
		stagger: 0.1,
		ease: "power4.out",
		delay: delay,
	});

	return split;
}

export function lineRevealAnimation(element: Element, delay = 0) {
	const textContent = getTextContent(element);
	if (!textContent.trim()) return null;

	const split = SplitText.create(element, {
		type: "lines",
		mask: "lines",
	});

	splitInstances.push(split);

	gsap.set(split.lines, {
		yPercent: 120,
	});

	gsap.to(split.lines, {
		duration: 0.8,
		yPercent: 0,
		stagger: 0.1,
		ease: "power4.out",
		delay: delay,
	});

	return split;
}

export function initAnimations() {
	if (!isDesktop()) return;

	document.fonts.ready.then(() => {
		const animatedElements = document.querySelectorAll("[data-animate-type]");
		const sectionsWithScrollElements = new Set<Element>();

		animatedElements.forEach((element) => {
			const animationType = element.getAttribute("data-animate-type");
			const delay =
				Number.parseFloat(element.getAttribute("data-animate-delay") ?? "") ||
				0;
			const animateOnScroll =
				element.getAttribute("data-animate-on-scroll") === "true";

			if (animateOnScroll) {
				gsap.set(element, { opacity: 0 });

				const parentSection = element.closest("section");
				if (!parentSection) return;

				if (!sectionsWithScrollElements.has(parentSection)) {
					sectionsWithScrollElements.add(parentSection);

					const observer = new IntersectionObserver(
						(entries) => {
							entries.forEach((entry) => {
								if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
									const sectionElements = entry.target.querySelectorAll(
										'[data-animate-on-scroll="true"]',
									);

									sectionElements.forEach((el) => {
										const elAnimationType =
											el.getAttribute("data-animate-type");
										const elDelay =
											Number.parseFloat(
												el.getAttribute("data-animate-delay") ?? "",
											) || 0;

										gsap.set(el, { opacity: 1 });

										switch (elAnimationType) {
											case "scramble":
												scrambleAnimation(el, elDelay);
												break;
											case "reveal":
												revealAnimation(el, elDelay);
												break;
											case "line-reveal":
												lineRevealAnimation(el, elDelay);
												break;
										}
									});

									observer.unobserve(entry.target);
								}
							});
						},
						{
							threshold: [0, 0.1, 0.3, 0.5, 0.7, 1.0],
							rootMargin: "0px 0px -20% 0px",
						},
					);

					observer.observe(parentSection);
				}
			} else {
				switch (animationType) {
					case "scramble":
						scrambleAnimation(element, delay);
						break;
					case "reveal":
						revealAnimation(element, delay);
						break;
					case "line-reveal":
						lineRevealAnimation(element, delay);
						break;
				}
			}
		});
	});
}

export function cleanupAnimations() {
	splitInstances.forEach((split) => {
		split.revert();
	});
	splitInstances = [];
}

export function animateElement(selector: string, type: string, delay = 0) {
	if (!isDesktop()) return;

	const element = document.querySelector(selector);
	if (!element) return;

	switch (type) {
		case "scramble":
			scrambleAnimation(element, delay);
			break;
		case "reveal":
			revealAnimation(element, delay);
			break;
		case "line-reveal":
			lineRevealAnimation(element, delay);
			break;
	}
}

export function animateElements(
	selector: string,
	type: string,
	delay = 0,
	staggerDelay = 0.1,
) {
	if (!isDesktop()) return;

	const elements = document.querySelectorAll(selector);
	if (!elements.length) return;

	elements.forEach((element, index) => {
		const totalDelay = delay + index * staggerDelay;

		switch (type) {
			case "scramble":
				scrambleAnimation(element, totalDelay);
				break;
			case "reveal":
				revealAnimation(element, totalDelay);
				break;
			case "line-reveal":
				lineRevealAnimation(element, totalDelay);
				break;
		}
	});
}
