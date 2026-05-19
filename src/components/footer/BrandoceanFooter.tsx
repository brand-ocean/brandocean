import { useEffect, useRef } from "react";
import { Brandmark, Logotype } from "@/components/brand";
import "./BrandoceanFooter.css";

const PARTICLE_IMAGES = [
	"https://brandocean.nl/images/10-20kopie-cc-88ren.avif",
	"https://brandocean.nl/images/65e8dc958012c733c79ba2c2_dztiwhlwsay1bjc-p-2600.avif",
	"https://brandocean.nl/images/nerds.avif",
	"https://brandocean.nl/images/filmmuseum-20eye.avif",
	"https://brandocean.nl/images/bruhn.avif",
	"https://brandocean.nl/images/link-20-e2-86-92-20scenes-lp-cover.png.avif",
	"https://kiesbeter.app/_built/home-hero-2025-768-870330795b.jpg",
	"https://brandocean.nl/images/10-20kopie-cc-88ren-1.avif",
	"https://brandocean.nl/images/img_4741-20-1-.avif",
	"https://brandocean.nl/images/img_5889.avif",
];

const EXPLOSION_CONFIG = {
	gravity: 0.25,
	friction: 0.99,
	imageSize: 150,
	horizontalForce: 20,
	verticalForce: 15,
	rotationSpeed: 10,
};

class Particle {
	element: HTMLImageElement;
	x = 0;
	y = 0;
	vx: number;
	vy: number;
	rotation = 0;
	rotationSpeed: number;

	constructor(element: HTMLImageElement) {
		this.element = element;
		this.vx = (Math.random() - 0.5) * EXPLOSION_CONFIG.horizontalForce;
		this.vy = -EXPLOSION_CONFIG.verticalForce - Math.random() * 10;
		this.rotationSpeed = (Math.random() - 0.5) * EXPLOSION_CONFIG.rotationSpeed;
	}

	update() {
		this.vy += EXPLOSION_CONFIG.gravity;
		this.vx *= EXPLOSION_CONFIG.friction;
		this.vy *= EXPLOSION_CONFIG.friction;
		this.rotationSpeed *= EXPLOSION_CONFIG.friction;

		this.x += this.vx;
		this.y += this.vy;
		this.rotation += this.rotationSpeed;

		this.element.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.rotation}deg)`;
	}
}

export function BrandoceanFooter() {
	const footerRef = useRef<HTMLElement>(null);
	const explosionRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const footer = footerRef.current;
		const container = explosionRef.current;
		if (!footer || !container) return;

		PARTICLE_IMAGES.forEach((src) => {
			const img = new Image();
			img.src = src;
		});

		let hasExploded = false;
		let animationId: number | null = null;

		const createParticles = (): HTMLImageElement[] => {
			container.innerHTML = "";
			return PARTICLE_IMAGES.map((src) => {
				const img = document.createElement("img");
				img.src = src;
				img.classList.add("explosion-particle-img");
				img.style.width = `${EXPLOSION_CONFIG.imageSize}px`;
				container.appendChild(img);
				return img;
			});
		};

		const explode = () => {
			if (hasExploded) return;
			hasExploded = true;

			const particles = createParticles().map((el) => new Particle(el));

			const tick = () => {
				particles.forEach((p) => p.update());
				animationId = requestAnimationFrame(tick);

				if (particles.every((p) => p.y > container.offsetHeight / 2)) {
					if (animationId !== null) cancelAnimationFrame(animationId);
					animationId = null;
				}
			};
			tick();
		};

		const checkPosition = () => {
			const rect = footer.getBoundingClientRect();
			const vh = window.innerHeight;

			if (rect.top > vh + 100) hasExploded = false;
			if (!hasExploded && rect.top <= vh + 250) explode();
		};

		let scrollTimeout: number | undefined;
		const onScroll = () => {
			window.clearTimeout(scrollTimeout);
			scrollTimeout = window.setTimeout(checkPosition, 5);
		};
		const onResize = () => {
			hasExploded = false;
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize);
		createParticles();
		const initialCheck = window.setTimeout(checkPosition, 500);

		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onResize);
			window.clearTimeout(scrollTimeout);
			window.clearTimeout(initialCheck);
			if (animationId !== null) cancelAnimationFrame(animationId);
		};
	}, []);

	return (
		<footer className="bo-footer" ref={footerRef}>
			<div className="footer-container">
				<div className="footer-header">
					<Logotype height={44} />
				</div>

				<div className="footer-row">
					<div className="footer-col">
						<p>Quick Jumps</p>
						<p>
							<a href="/projecten">Projecten</a>
						</p>
						<p>
							<a href="/over-ons">Over Ons</a>
						</p>
						<p>
							<a href="/contact">Contact</a>
						</p>
					</div>
					<div className="footer-col">
						<p>Side Streets</p>
						<p>
							<a href="/diensten">Diensten</a>
						</p>
						<p>
							<a href="/projecten">Showreel</a>
						</p>
						<p>
							<a href="mailto:info@brandocean.nl">Email Us</a>
						</p>
					</div>
					<div className="footer-col">
						<p>Social Signals</p>
						<p>
							<a
								href="https://instagram.com/brandocean"
								target="_blank"
								rel="noopener noreferrer"
							>
								Instagram
							</a>
						</p>
						<p>
							<a
								href="https://linkedin.com/company/brandocean"
								target="_blank"
								rel="noopener noreferrer"
							>
								LinkedIn
							</a>
						</p>
						<p>
							<a
								href="mailto:info@brandocean.nl"
							>
								Email
							</a>
						</p>
					</div>
					<div className="footer-col">
						<p>Alt Dimensions</p>
						<p>
							<a href="https://brandocean.nl" target="_blank" rel="noopener noreferrer">
								brandocean.nl
							</a>
						</p>
						<p>
							<a href="https://kiesbeter.app" target="_blank" rel="noopener noreferrer">
								Kiesbeter
							</a>
						</p>
					</div>
				</div>

				<div className="copyright-info">
					<Brandmark size={32} />
				</div>

				<div className="explosion-container" ref={explosionRef} />
			</div>
		</footer>
	);
}
