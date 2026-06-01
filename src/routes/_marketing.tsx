import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { LenisProvider } from "@/components/LenisProvider";
import { Navigation } from "@/components/navigation/Navigation";
import { BrandoceanFooter } from "@/components/footer/BrandoceanFooter";
import { convex } from "@/lib/convex";

export const Route = createFileRoute("/_marketing")({
	component: MarketingLayout,
});

function MarketingLayout() {
	return (
		<ConvexProvider client={convex}>
			<LenisProvider>
				<div className="marketing-area">
					<Navigation />
					<Outlet />
					<BrandoceanFooter />
				</div>
			</LenisProvider>
		</ConvexProvider>
	);
}
