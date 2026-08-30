import { createFileRoute } from "@tanstack/react-router";
import Preloader from "@/site/components/Preloader/Preloader";

/**
 * De coming-soon-pagina is de footer. Preloader speelt af en verdwijnt, daarna
 * staat er één scherm: het woordmerk, de vallende badges en het contact. De
 * footer komt uit SiteLayout en staat daar in zijn `minimal`-variant.
 */
export const Route = createFileRoute("/_site/")({
	component: Home,
});

function Home() {
	return <Preloader />;
}
