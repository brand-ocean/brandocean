import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import AnimeText from "@/site/components/AnimeText/AnimeText";
import FeaturedWork from "@/site/components/FeaturedWork/FeaturedWork";
import HeroSpotlight from "@/site/components/HeroSpotlight/HeroSpotlight";
import Preloader from "@/site/components/Preloader/Preloader";
import { api } from "~convex/_generated/api";

/**
 * De echte homepage, zolang `/` nog de coming-soon-landing is. Zelfde opbouw
 * als voor de landing: Preloader, spotlight, de tekstanimatie en het
 * uitgelichte werk. De Preloader dekt het scherm af tot de fonts er zijn en
 * de hero klaarstaat, zodat er niks flitst.
 */
export const Route = createFileRoute("/_site/home")({
	component: HomePage,
});

function HomePage() {
	const featured = useQuery(api.portfolio.listFeatured, { limit: 4 });

	return (
		<>
			<Preloader />
			<HeroSpotlight />
			<AnimeText />
			<FeaturedWork items={featured ?? []} />
		</>
	);
}
