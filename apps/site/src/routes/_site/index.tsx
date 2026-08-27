import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import AnimeText from "@/site/components/AnimeText/AnimeText";
import FeaturedWork from "@/site/components/FeaturedWork/FeaturedWork";
import HeroSpotlight from "@/site/components/HeroSpotlight/HeroSpotlight";
import Preloader from "@/site/components/Preloader/Preloader";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_site/")({
	component: Home,
});

function Home() {
	const featured = useQuery(api.portfolio.listFeatured, { limit: 4 });

	return (
		<>
			<Preloader />
			<HeroSpotlight />
			<AnimeText />
			<FeaturedWork items={featured ?? []} />
			{/* Testimonials staan uit tot er goedgekeurde quotes zijn — de
			    huidige zijn door onszelf geschreven en staan op naam van
			    echte klanten. Terugzetten: import + <Testimonials />. */}
		</>
	);
}
