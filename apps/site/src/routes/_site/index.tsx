import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/site/components/Landing/Landing";
import Preloader from "@/site/components/Preloader/Preloader";

export const Route = createFileRoute("/_site/")({
	component: Home,
});

function Home() {
	return (
		<>
			<Preloader />
			<Landing />
		</>
	);
}
