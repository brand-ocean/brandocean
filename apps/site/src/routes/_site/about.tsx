import { createFileRoute } from "@tanstack/react-router";
import AboutCopy from "@/site/components/AboutCopy/AboutCopy";
import SmudgeRevealer from "@/site/components/SmudgeRevealer/SmudgeRevealer";
import Spotlight from "@/site/components/Spotlight/Spotlight";
import Stats from "@/site/components/Stats/Stats";
import Team from "@/site/components/Team/Team";
import styles from "@/site/pages/about.module.css";

export const Route = createFileRoute("/_site/about")({
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
