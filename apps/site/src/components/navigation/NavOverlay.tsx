"use client";

import { Link } from "@tanstack/react-router";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { BREAKPOINTS } from "@/constants";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import "./NavOverlay.css";

interface NavOverlayProps {
	isOpen: boolean;
	onClose: () => void;
}

function FlipChars({ label }: { label: string }) {
	return (
		<>
			{label.split("").map((ch, i) => (
				<span
					key={`${label}-${i}-${ch}`}
					className="navlink-char"
					aria-hidden="true"
				>
					{ch}
				</span>
			))}
		</>
	);
}

const navLinks = [
	{ to: "/", label: "Home" },
	{ to: "/diensten", label: "Diensten" },
	{ to: "/projecten", label: "Projecten" },
	{ to: "/over-ons", label: "Over Ons" },
	{ to: "/contact", label: "Contact" },
];

export function NavOverlay({ isOpen, onClose }: NavOverlayProps) {
	const { theme, toggleTheme } = useTheme();
	const { language, toggleLanguage } = useLanguage();
	const overlayRef = useRef<HTMLDivElement>(null);
	const navItemsRef = useRef<HTMLLIElement[]>([]);
	const footerRef = useRef<HTMLDivElement>(null);
	const linkWrappersRef = useRef<HTMLDivElement[]>([]);
	const [isMobile, setIsMobile] = useState(false);
	const [time, setTime] = useState("");
	const isFirstRender = useRef(true);

	useEffect(() => {
		if (typeof window === "undefined") return;
		setIsMobile(window.innerWidth <= BREAKPOINTS.mobile);

		const handleResize = () =>
			setIsMobile(window.innerWidth <= BREAKPOINTS.mobile);
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		const wrappers = linkWrappersRef.current.filter(Boolean);
		if (wrappers.length === 0) return;

		const cleanups: Array<() => void> = [];

		wrappers.forEach((wrapper) => {
			const top = wrapper.querySelectorAll<HTMLElement>(
				".navlink-row--top .navlink-char",
			);
			const ghost = wrapper.querySelectorAll<HTMLElement>(
				".navlink-row--ghost .navlink-char",
			);
			gsap.set(top, { y: "0%" });
			gsap.set(ghost, { y: "110%" });

			const canHover = () =>
				typeof window !== "undefined" &&
				window.matchMedia("(hover: hover)").matches;

			const onEnter = () => {
				if (!canHover()) return;
				gsap.to(top, {
					y: "-110%",
					stagger: 0.04,
					duration: 0.5,
					ease: "expo.inOut",
				});
				gsap.to(ghost, {
					y: "0%",
					stagger: 0.04,
					duration: 0.5,
					ease: "expo.inOut",
				});
			};
			const onLeave = () => {
				if (!canHover()) return;
				gsap.to(ghost, {
					y: "110%",
					stagger: 0.04,
					duration: 0.5,
					ease: "expo.inOut",
				});
				gsap.to(top, {
					y: "0%",
					stagger: 0.04,
					duration: 0.5,
					ease: "expo.inOut",
				});
			};

			wrapper.addEventListener("mouseenter", onEnter);
			wrapper.addEventListener("mouseleave", onLeave);
			cleanups.push(() => {
				wrapper.removeEventListener("mouseenter", onEnter);
				wrapper.removeEventListener("mouseleave", onLeave);
			});
		});

		return () => {
			cleanups.forEach((fn) => fn());
		};
	}, [isMobile]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const updateTime = () => {
			const now = new Date();
			const timeString = now.toLocaleTimeString("en-US", { hour12: false });
			setTime(`${timeString} LOCAL`);
		};

		updateTime();
		const interval = setInterval(updateTime, 1000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const overlay = overlayRef.current;
		if (!overlay) return;

		if (isFirstRender.current) {
			gsap.set(overlay, { scaleY: 0, transformOrigin: "top center" });
			navItemsRef.current.forEach((item) => {
				if (item) gsap.set(item, { y: 50, opacity: 0 });
			});
			if (footerRef.current) {
				gsap.set(footerRef.current, { y: 20, opacity: 0 });
			}
			isFirstRender.current = false;
			return;
		}

		if (isOpen) {
			const tl = gsap.timeline();

			tl.to(overlay, {
				scaleY: 1,
				duration: 0.5,
				ease: "power3.out",
			});

			tl.to(
				navItemsRef.current,
				{
					y: 0,
					opacity: 1,
					duration: 0.4,
					stagger: 0.05,
					ease: "power3.out",
				},
				"-=0.3",
			);

			if (footerRef.current) {
				tl.to(
					footerRef.current,
					{
						y: 0,
						opacity: 1,
						duration: 0.3,
						ease: "power2.out",
					},
					"-=0.3",
				);
			}
		} else {
			const tl = gsap.timeline();

			if (footerRef.current) {
				tl.to(footerRef.current, {
					y: 20,
					opacity: 0,
					duration: 0.2,
					ease: "power2.in",
				});
			}

			tl.to(
				navItemsRef.current,
				{
					y: 50,
					opacity: 0,
					duration: 0.25,
					stagger: -0.03,
					ease: "power2.in",
				},
				"-=0.15",
			);

			tl.to(
				overlay,
				{
					scaleY: 0,
					duration: 0.4,
					ease: "power3.inOut",
				},
				"-=0.2",
			);
		}
	}, [isOpen]);

	return (
		<div
			ref={overlayRef}
			style={{
				position: "absolute",
				top: "100%",
				left: 0,
				right: 0,
				backgroundColor: "var(--color-base-300)",
				borderRadius: "0 0 8px 8px",
				marginTop: "-8px",
				paddingTop: "8px",
				transformOrigin: "top",
				overflow: "hidden",
				transform: "scaleY(0)",
			}}
		>
			<nav style={{ padding: "2rem 0 3rem 0" }}>
				<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
					{navLinks.map((link, index) => (
						<li
							key={link.to}
							ref={(el) => {
								if (el) navItemsRef.current[index] = el;
							}}
							style={{ margin: "-4px 0" }}
						>
							<div
								className="navlink-wrapper"
								ref={(el) => {
									if (el) linkWrappersRef.current[index] = el;
								}}
							>
								<Link
									to={link.to}
									onClick={onClose}
									aria-label={link.label}
									style={{
										display: "block",
										padding: isMobile ? "0.75rem 1.5rem" : "0.5rem 1.75rem",
										textTransform: "uppercase",
										textDecoration: "none",
										color: "var(--color-base-100)",
										fontFamily: '"Barlow Condensed", sans-serif',
										fontSize: isMobile ? "2.75rem" : "4.25rem",
										letterSpacing: "-0.02rem",
										fontWeight: 900,
										lineHeight: 0.85,
									}}
								>
									<span className="navlink-flip">
										<span
											className="navlink-row navlink-row--top"
											aria-hidden="true"
										>
											<FlipChars label={link.label} />
										</span>
										<span
											className="navlink-row navlink-row--ghost"
											aria-hidden="true"
										>
											<FlipChars label={link.label} />
										</span>
									</span>
								</Link>
							</div>
						</li>
					))}
				</ul>
			</nav>

			<div
				ref={footerRef}
				style={{
					padding: isMobile ? "2rem 1.75rem" : "1rem 1.75rem 1.5rem",
					display: "flex",
					justifyContent: "space-between",
					alignItems: isMobile ? "flex-start" : "center",
					flexDirection: isMobile ? "column" : "row",
				}}
			>
				<div
					style={{
						display: "flex",
						gap: isMobile ? "0.5rem" : "1rem",
						flexWrap: isMobile ? "wrap" : "nowrap",
					}}
				>
					<button
						type="button"
						onClick={toggleTheme}
						aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
						style={{
							background: "transparent",
							border: "none",
							padding: 0,
							cursor: "pointer",
							color: "var(--color-base-100)",
							fontSize: "0.85rem",
							textTransform: "uppercase",
							fontFamily: '"DM Mono", monospace',
							fontWeight: 500,
						}}
					>
						<span style={{ position: "relative", top: "-0.1rem" }}>
							&#9654;
						</span>{" "}
						{theme === "dark" ? "Light Mode" : "Dark Mode"}
					</button>
					<button
						type="button"
						onClick={toggleLanguage}
						aria-label={`Switch language to ${language === "en" ? "Dutch" : "English"}`}
						style={{
							background: "transparent",
							border: "none",
							padding: 0,
							cursor: "pointer",
							color: "var(--color-base-100)",
							fontSize: "0.85rem",
							textTransform: "uppercase",
							fontFamily: '"DM Mono", monospace',
							fontWeight: 500,
						}}
					>
						<span style={{ position: "relative", top: "-0.1rem" }}>
							&#9654;
						</span>{" "}
						{language === "en" ? "Nederlands" : "English"}
					</button>
				</div>
				<div
					style={{
						color: "var(--color-base-secondary)",
						fontSize: "0.85rem",
						textTransform: "uppercase",
						fontFamily: '"DM Mono", monospace',
						fontWeight: 500,
						marginTop: isMobile ? "1rem" : 0,
					}}
					suppressHydrationWarning
				>
					{time}
				</div>
			</div>
		</div>
	);
}
