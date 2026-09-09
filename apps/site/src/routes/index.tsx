import { createFileRoute } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { getConvexClient } from "@/lib/convex";
import ComingSoonLayout from "@/site/ComingSoonLayout";
import Preloader from "@/site/components/Preloader/Preloader";

/**
 * De coming-soon-pagina is de footer. Preloader speelt af en verdwijnt, daarna
 * staat er één scherm: het woordmerk, de vallende badges en het contact.
 *
 * Bewust buiten `_site`: de landing deelt niets met de marketingsite — geen
 * menu, geen paginatransitie. De echte homepage staat op /home.
 */
export const Route = createFileRoute("/")({
	component: ComingSoon,
});

function ComingSoon() {
	return (
		<ConvexProvider client={getConvexClient()}>
			<ComingSoonLayout>
				<Preloader />
			</ComingSoonLayout>
		</ConvexProvider>
	);
}
