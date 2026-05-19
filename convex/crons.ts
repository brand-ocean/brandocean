import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
	"rebalance item and section orders nightly",
	"0 3 * * *",
	internal.items.rebalanceAll,
);

export default crons;
