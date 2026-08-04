import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState } from "react";
import Callout from "../Callout/Callout";
import styles from "./ExpertiseServices.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const DESKTOP_BREAKPOINT = 900;
const SERVICES = [
	{
		title: "Illustration",
		items: [
			"Editorial & Cover Art",
			"Poster & Print Series",
			"Spot Illustrations & Icons",
			"Album & Merch Artwork",
			"Custom Commissions",
		],
	},
	{
		title: "Character Design",
		items: [
			"Original Characters & Casts",
			"Mascots & Brand Creatures",
			"Turnarounds & Expression Sheets",
			"Character Bibles",
			"Sticker & Emote Packs",
		],
	},
	{
		title: "Animation & Motion",
		items: [
			"Looping Idents & Bumpers",
			"Character Rigs & Movement",
			"Animated Stickers & GIFs",
			"Social Cutdowns",
			"Title & Transition Sequences",
		],
	},
	{
		title: "Worldbuilding",
		items: [
			"Illustrated Universes",
			"Environment & Set Design",
			"Lore & Story Development",
			"Props & Visual Systems",
			"Scene & Panel Layouts",
		],
	},
	{
		title: "Brand Art",
		items: [
			"Visual Identity & Wordmarks",
			"Murals & Wall Art",
			"Packaging & Label Art",
			"Zines & Lookbooks",
			"Launch & Campaign Visuals",
		],
	},
];

export default function ExpertiseServices() {
	const sectionRef = useRef<HTMLElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const servicesRef = useRef<HTMLDivElement>(null);
	const scrollTriggerRef = useRef<ScrollTrigger | null>(null);
	const [windowWidth, setWindowWidth] = useState(0);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useEffect(() => {
		if (typeof window !== "undefined") {
			setWindowWidth(window.innerWidth);
		}
	}, []);

	useGSAP(
		() => {
			if (scrollTriggerRef.current) {
				scrollTriggerRef.current.kill();
				scrollTriggerRef.current = null;
			}

			const handleResize = () => {
				setWindowWidth(window.innerWidth);
			};

			window.addEventListener("resize", handleResize);

			const timeoutId = setTimeout(() => {
				if (windowWidth > DESKTOP_BREAKPOINT) {
					const expertiseSection = sectionRef.current;
					const expertiseHeader = headerRef.current;
					const services = servicesRef.current;

					if (expertiseSection && expertiseHeader && services) {
						ScrollTrigger.refresh();

						scrollTriggerRef.current = ScrollTrigger.create({
							trigger: expertiseSection,
							start: "top top",
							endTrigger: services,
							end: "bottom bottom",
							pin: expertiseHeader,
							pinSpacing: false,
							onEnter: () => {
								gsap.to(expertiseHeader, { duration: 0.1, ease: "power1.out" });
							},
						});
					}
				}
			}, 100);

			return () => {
				window.removeEventListener("resize", handleResize);
				clearTimeout(timeoutId);

				if (scrollTriggerRef.current) {
					scrollTriggerRef.current.kill();
				}
			};
		},
		{ dependencies: [windowWidth], scope: sectionRef },
	);

	return (
		<section className={styles.expertise} ref={sectionRef}>
			<div className={styles.header} ref={headerRef}>
				<div className={`container pad ${styles.headerInner}`}>
					<div className={styles.row}>
						<h1>
							The Things We Nail
							<Callout
								className={styles.callout}
								label="Dead on"
								variant={1}
								rotation={-20}
								top="0.25em"
								left="-0.1em"
							/>
						</h1>

						<div className={styles.imageOne}>
							<img src="/images/expertise/expertise_service_1.jpg" alt="" />
						</div>
					</div>

					<div className={styles.row}>
						<div className={styles.imageTwo}>
							<img src="/images/expertise/expertise_service_2.jpg" alt="" />
						</div>
					</div>
				</div>
			</div>

			<div className={styles.services} ref={servicesRef}>
				<div className={styles.spacer} />

				<div className={styles.list}>
					{SERVICES.map((service) => (
						<div key={service.title} className={styles.service}>
							<h6>{service.title}</h6>
							{service.items.map((item) => (
								<p key={item}>{item}</p>
							))}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
