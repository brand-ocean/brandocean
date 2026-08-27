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

// Usage billing: pull the previous complete UTC day of Cloudflare usage, then
// (later) close out any due billing periods and charge via Mollie.
crons.cron(
	"pull cloudflare usage daily",
	"0 2 * * *",
	internal.billing.cloudflare.pullDaily,
	{},
);

crons.cron(
	"run due billing periods daily",
	"0 4 * * *",
	internal.billing.run.runDue,
	{},
);

export default crons;
