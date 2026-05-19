import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/hero/Hero";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<div className="min-h-screen bg-base-100">
			<Hero />
		</div>
	);
}
