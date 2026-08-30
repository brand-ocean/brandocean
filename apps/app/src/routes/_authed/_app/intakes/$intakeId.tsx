import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeftIcon } from "lucide-react";

import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { TonePill } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/intakes/$intakeId")({
	component: IntakeDetail,
});

function IntakeDetail() {
	const { intakeId } = Route.useParams();
	const data = useQuery(api.intakes.getForOwner, {
		intakeId: intakeId as Id<"intakes">,
	});

	if (data === undefined) {
		return (
			<Frame>
				<FramePanel>
					<p className="text-muted-foreground p-6">Laden…</p>
				</FramePanel>
			</Frame>
		);
	}
	if (data === null) {
		return (
			<Frame>
				<FramePanel>
					<p className="text-muted-foreground p-6">Deze intake bestaat niet.</p>
				</FramePanel>
			</Frame>
		);
	}

	const { intake, answers } = data;
	const gesteld = answers.length;
	const doorgevraagd = answers.filter((a) => a.generated).length;

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>{intake.name || "Naamloos"}</FrameTitle>
					<FrameDescription>
						{[intake.company, intake.email].filter(Boolean).join(" · ") ||
							"Geen contactgegevens opgegeven"}
					</FrameDescription>
				</FrameHeading>
				<Button size="sm" variant="outline" render={<Link to="/intakes" />}>
					<ArrowLeftIcon className="size-4" />
					Terug
				</Button>
			</FrameHeader>

			{intake.stackAdvies ? (
				<FramePanel className="p-6">
					<p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
						Aanpak
					</p>
					<p className="text-lg font-medium">{intake.stackAdvies}</p>
					<div className="mt-4 flex flex-wrap items-center gap-2">
						<TonePill tone="muted">{gesteld} vragen</TonePill>
						{doorgevraagd > 0 ? (
							<TonePill tone="info">{doorgevraagd} doorgevraagd</TonePill>
						) : null}
						{intake.modelUsed ? (
							<TonePill tone="muted">{intake.modelUsed}</TonePill>
						) : null}
						{intake.tokensUsed ? (
							<TonePill tone="muted">
								{intake.tokensUsed.toLocaleString("nl-NL")} tokens
							</TonePill>
						) : null}
					</div>
				</FramePanel>
			) : null}

			{intake.brief ? (
				<FramePanel className="p-6">
					<p className="text-muted-foreground mb-3 text-xs uppercase tracking-wide">
						Brief — alleen voor jou
					</p>
					<p className="whitespace-pre-wrap leading-relaxed">{intake.brief}</p>
				</FramePanel>
			) : null}

			{intake.summary ? (
				<FramePanel className="p-6">
					<p className="text-muted-foreground mb-3 text-xs uppercase tracking-wide">
						Dit zag de klant
					</p>
					<p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
						{intake.summary}
					</p>
				</FramePanel>
			) : null}

			<FramePanel className="p-6">
				<p className="text-muted-foreground mb-4 text-xs uppercase tracking-wide">
					Het gesprek
				</p>
				<div className="flex flex-col gap-5">
					{answers.map((a) => (
						<div key={a._id} className="flex flex-col gap-1">
							<div className="flex items-baseline gap-2">
								<p className="font-medium">{a.question}</p>
								{a.generated ? (
									<TonePill tone="info" size="sm">
										doorgevraagd
									</TonePill>
								) : null}
							</div>
							<p className="text-muted-foreground whitespace-pre-wrap">
								{a.answer?.trim() || "Niet beantwoord"}
							</p>
						</div>
					))}
				</div>
			</FramePanel>
		</Frame>
	);
}
