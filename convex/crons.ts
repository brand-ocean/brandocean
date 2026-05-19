import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
	"rebalance item and section orders nightly",
	"0 3 * * *",
	internal.items.rebalanceAll,
);

crons.cron(
	"prune stale feedback rate buckets daily",
	"30 3 * * *",
	internal.feedback.pruneRateBuckets,
	{},
);

export default crons;
