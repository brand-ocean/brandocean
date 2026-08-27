import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/hero/Hero";
import { ObservationRegistry } from "@/components/portfolio/ObservationRegistry";

export const Route = createFileRoute("/_marketing/v1")({
	component: MarketingHome,
});

function MarketingHome() {
	return (
		<div className="min-h-screen bg-base-100">
			<Hero />
			<ObservationRegistry />
		</div>
	);
}
