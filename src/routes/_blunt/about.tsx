import { createFileRoute } from "@tanstack/react-router";
import AboutCopy from "@/blunt/components/AboutCopy/AboutCopy";
import SmudgeRevealer from "@/blunt/components/SmudgeRevealer/SmudgeRevealer";
import Spotlight from "@/blunt/components/Spotlight/Spotlight";
import Stats from "@/blunt/components/Stats/Stats";
import Team from "@/blunt/components/Team/Team";
import styles from "@/blunt/pages/about.module.css";

export const Route = createFileRoute("/_blunt/about")({
	component: AboutPage,
});

function AboutPage() {
	return (
		<main className={styles.page}>
			<SmudgeRevealer
				lineOne="Wipe Here"
				lineTwo="To Meet Us"
				copy="Twenty Years Of Building. One Person You Have To Call."
			/>
			<Spotlight />
			<AboutCopy />
			<Stats />
			<Team />
		</main>
	);
}
