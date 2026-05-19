import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";

const body = JSON.parse(
	fs.readFileSync("scripts/dutchglobalmedia-offerte.json", "utf8"),
);

// Reuse the existing token so the already-shared link stays valid.
const token = "nbiiw0gba1OXp2kmTnABDnso";

const args = {
	slug: "dutchglobalmedia-offerte",
	title: "DUTCHGLOBALMEDIA — Influencer Marketing Dashboard",
	body,
	shareToken: token,
	schemaVersion: 1,
	published: true,
	publicReadable: false,
	ownerId: "kd717f40pzfmwd58dk6f0gw80x85h6k1",
};

const res = spawnSync(
	"npx",
	["convex", "run", "--prod", "admin:importOfferte", JSON.stringify(args)],
	{ stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
);

process.stdout.write(res.stdout || "");
process.stderr.write(res.stderr || "");
console.log("\nshareToken:", token);
process.exit(res.status ?? 1);
