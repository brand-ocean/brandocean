import gsap from "gsap";
import { useEffect, useRef } from "react";
import styles from "./CareersList.module.css";

const POSITIONS = {
	BOTTOM: "0%",
	MIDDLE: "-33.333%",
	TOP: "-66.666%",
};

// Geen dichtgetimmerde vacatures: dit zijn de mensen waar we altijd mee willen
// praten. Elke regel klapt open naar hetzelfde antwoord — mail ons gewoon.
const OPENINGS = [
	{
		name: "Full-stack developer",
		type: "Freelance",
		location: "Remote",
		label: "Mail ons",
	},
	{
		name: "Front-end developer",
		type: "Projectbasis",
		location: "Amsterdam",
		label: "Mail ons",
	},
	{
		name: "Product designer",
		type: "Freelance",
		location: "Remote",
		label: "Mail ons",
	},
	{
		name: "UI/UX designer",
		type: "Projectbasis",
		location: "Amsterdam",
		label: "Mail ons",
	},
	{
		name: "Merkontwerper",
		type: "Freelance",
		location: "Remote",
		label: "Mail ons",
	},
	{
		name: "Motion designer",
		type: "Projectbasis",
		location: "Waar dan ook",
		label: "Mail ons",
	},
	{
		name: "AI engineer",
		type: "Freelance",
		location: "Remote",
		label: "Mail ons",
	},
	{
		name: "Data-analist",
		type: "Projectbasis",
		location: "Amsterdam",
		label: "Mail ons",
	},
	{
		name: "CRO-specialist",
		type: "Freelance",
		location: "Remote",
		label: "Mail ons",
	},
	{
		name: "Copywriter",
		type: "Projectbasis",
		location: "Waar dan ook",
		label: "Mail ons",
	},
	{
		name: "Stage of leerplek",
		type: "In overleg",
		location: "Amsterdam",
		label: "Mail ons",
	},
	{
		name: "Iets heel anders",
		type: "Verras ons",
		location: "Waar dan ook",
		label: "Mail ons",
	},
];

export default function CareersList() {
	const listRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

	useEffect(() => {
		const items = itemRefs.current.filter((el): el is HTMLDivElement =>
			Boolean(el),
		);
		if (!listRef.current || items.length === 0) return;

		const lastMousePosition = { x: 0, y: 0 };
		let activeItem: HTMLDivElement | null = null;
		let ticking = false;
		const hoverHandlers = new Map<
			HTMLDivElement,
			{ enter: (e: MouseEvent) => void; leave: (e: MouseEvent) => void }
		>();
		const itemPositions = new Map<HTMLDivElement, string>();
		let mousemoveHandler: ((e: MouseEvent) => void) | null = null;
		let scrollHandler: (() => void) | null = null;

		function updateItems() {
			if (activeItem) {
				const rect = activeItem.getBoundingClientRect();
				const isStillOver =
					lastMousePosition.x >= rect.left &&
					lastMousePosition.x <= rect.right &&
					lastMousePosition.y >= rect.top &&
					lastMousePosition.y <= rect.bottom;

				if (!isStillOver) {
					const wrapper = activeItem.querySelector(`.${styles.wrapper}`);
					const leavingFromTop =
						lastMousePosition.y < rect.top + rect.height / 2;

					gsap.to(wrapper, {
						y: leavingFromTop ? POSITIONS.TOP : POSITIONS.BOTTOM,
						duration: 0.4,
						ease: "power2.out",
					});
					activeItem = null;
				}
			}

			items.forEach((item) => {
				if (item === activeItem) return;

				const rect = item.getBoundingClientRect();
				const isMouseOver =
					lastMousePosition.x >= rect.left &&
					lastMousePosition.x <= rect.right &&
					lastMousePosition.y >= rect.top &&
					lastMousePosition.y <= rect.bottom;

				if (isMouseOver) {
					const wrapper = item.querySelector(`.${styles.wrapper}`);
					gsap.to(wrapper, {
						y: POSITIONS.MIDDLE,
						duration: 0.4,
						ease: "power2.out",
					});
					activeItem = item;
				}
			});

			ticking = false;
		}

		function setupMouseListeners() {
			const isMobile = window.innerWidth < 1000;

			if (mousemoveHandler) {
				document.removeEventListener("mousemove", mousemoveHandler);
				mousemoveHandler = null;
			}
			if (scrollHandler) {
				document.removeEventListener("scroll", scrollHandler);
				scrollHandler = null;
			}

			if (!isMobile) {
				mousemoveHandler = (e: MouseEvent) => {
					lastMousePosition.x = e.clientX;
					lastMousePosition.y = e.clientY;
				};
				document.addEventListener("mousemove", mousemoveHandler);

				scrollHandler = () => {
					if (!ticking) {
						requestAnimationFrame(updateItems);
						ticking = true;
					}
				};
				document.addEventListener("scroll", scrollHandler, { passive: true });
			}
		}

		function setupHoverListeners() {
			const isMobile = window.innerWidth < 1000;

			items.forEach((item) => {
				const wrapper = item.querySelector(`.${styles.wrapper}`);
				if (!wrapper) return;

				const existing = hoverHandlers.get(item);
				if (existing) {
					item.removeEventListener("mouseenter", existing.enter);
					item.removeEventListener("mouseleave", existing.leave);
					hoverHandlers.delete(item);
				}

				if (!isMobile) {
					if (!itemPositions.has(item)) {
						itemPositions.set(item, POSITIONS.BOTTOM);
					}

					const enterHandler = (e: MouseEvent) => {
						activeItem = item;
						const rect = item.getBoundingClientRect();
						const enterFromTop = e.clientY < rect.top + rect.height / 2;
						const currentPosition = itemPositions.get(item);

						if (enterFromTop || currentPosition === POSITIONS.BOTTOM) {
							itemPositions.set(item, POSITIONS.MIDDLE);
							gsap.to(wrapper, {
								y: POSITIONS.MIDDLE,
								duration: 0.4,
								ease: "power2.out",
							});
						}
					};

					const leaveHandler = (e: MouseEvent) => {
						activeItem = null;
						const rect = item.getBoundingClientRect();
						const leavingFromTop = e.clientY < rect.top + rect.height / 2;
						const newPosition = leavingFromTop
							? POSITIONS.TOP
							: POSITIONS.BOTTOM;

						itemPositions.set(item, newPosition);
						gsap.to(wrapper, {
							y: newPosition,
							duration: 0.4,
							ease: "power2.out",
						});
					};

					item.addEventListener("mouseenter", enterHandler);
					item.addEventListener("mouseleave", leaveHandler);

					hoverHandlers.set(item, {
						enter: enterHandler,
						leave: leaveHandler,
					});
				} else {
					itemPositions.set(item, POSITIONS.BOTTOM);
					gsap.set(wrapper, { y: POSITIONS.BOTTOM });
				}
			});
		}

		setupMouseListeners();
		setupHoverListeners();

		let resizeTimeout: ReturnType<typeof setTimeout>;
		const handleResize = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				setupHoverListeners();
				setupMouseListeners();
			}, 100);
		};

		window.addEventListener("resize", handleResize);

		return () => {
			clearTimeout(resizeTimeout);
			window.removeEventListener("resize", handleResize);

			if (mousemoveHandler) {
				document.removeEventListener("mousemove", mousemoveHandler);
			}
			if (scrollHandler) {
				document.removeEventListener("scroll", scrollHandler);
			}

			items.forEach((item) => {
				const handlers = hoverHandlers.get(item);
				if (handlers) {
					item.removeEventListener("mouseenter", handlers.enter);
					item.removeEventListener("mouseleave", handlers.leave);
				}
			});
		};
	}, []);

	return (
		<section className={styles.careers}>
			<p>Geen vacatures, wel altijd ruimte voor goede mensen</p>

			<div className={styles.list} ref={listRef}>
				{OPENINGS.map((opening, index) => (
					<div
						key={`${opening.name}-${index}`}
						className={styles.item}
						ref={(el) => {
							itemRefs.current[index] = el;
						}}
					>
						<div className={styles.wrapper}>
							<div className={styles.nameRow}>
								<h2>{opening.name}</h2>
								<h2>{opening.type}</h2>
							</div>
							<div className={styles.detailRow}>
								<h2>{opening.location}</h2>
								<h2>{opening.label}</h2>
							</div>
							<div className={styles.nameRow}>
								<h2>{opening.name}</h2>
								<h2>{opening.type}</h2>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
