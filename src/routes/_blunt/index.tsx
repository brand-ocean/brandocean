import { createFileRoute } from "@tanstack/react-router";
import About from "@/blunt/components/About/About";
import FeaturedWork from "@/blunt/components/FeaturedWork/FeaturedWork";
import HeroSpotlight from "@/blunt/components/HeroSpotlight/HeroSpotlight";
import Preloader from "@/blunt/components/Preloader/Preloader";
import Testimonials from "@/blunt/components/Testimonials/Testimonials";

export const Route = createFileRoute("/_blunt/")({
	component: Home,
});

function Home() {
	return (
		<>
			<Preloader />
			<HeroSpotlight />
			<About />
			<FeaturedWork />
			<Testimonials />
		</>
	);
}
