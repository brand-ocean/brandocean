import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LenisProvider } from "@/components/LenisProvider";
import { Navigation } from "@/components/navigation/Navigation";
import { BrandoceanFooter } from "@/components/footer/BrandoceanFooter";

export const Route = createFileRoute("/_marketing")({
	component: MarketingLayout,
});

function MarketingLayout() {
	return (
		<LenisProvider>
			<div className="marketing-area">
				<Navigation />
				<Outlet />
				<BrandoceanFooter />
			</div>
		</LenisProvider>
	);
}
