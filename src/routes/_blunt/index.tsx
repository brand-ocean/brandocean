import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import About from "@/blunt/components/About/About";
import FeaturedWork from "@/blunt/components/FeaturedWork/FeaturedWork";
import HeroSpotlight from "@/blunt/components/HeroSpotlight/HeroSpotlight";
import Preloader from "@/blunt/components/Preloader/Preloader";
import Testimonials from "@/blunt/components/Testimonials/Testimonials";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_blunt/")({
	component: Home,
});

function Home() {
	const featured = useQuery(api.portfolio.listFeatured, { limit: 4 });

	return (
		<>
			<Preloader />
			<HeroSpotlight />
			<About />
			<FeaturedWork items={featured ?? []} />
			<Testimonials />
		</>
	);
}
