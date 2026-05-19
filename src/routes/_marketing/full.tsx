import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/hero/Hero";
import { ObservationRegistry } from "@/components/portfolio/ObservationRegistry";

export const Route = createFileRoute("/_marketing/full")({ component: Home });

function Home() {
	return (
		<div className="min-h-screen bg-base-100">
			<Hero />
			<ObservationRegistry />
		</div>
	)
}
