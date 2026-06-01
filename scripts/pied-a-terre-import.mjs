import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";

const mdPath = "scripts/pied-a-terre-offerte.md";
const jsonPath = "scripts/pied-a-terre-offerte.json";

const convert = spawnSync(
	"node",
	["scripts/forz-convert.mjs", mdPath, jsonPath],
	{ stdio: "inherit", encoding: "utf8" },
);
if (convert.status !== 0) process.exit(convert.status ?? 1);

const body = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const shareToken =
	process.env.OFFERTE_SHARE_TOKEN ??
	crypto.randomBytes(18).toString("base64url").slice(0, 24);

const args = {
	slug: "pied-a-terre-offerte",
	title: "Pied à Terre — Website & Guesty booking",
	body,
	shareToken,
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
console.log("\nshareToken:", shareToken);
console.log("slug: pied-a-terre-offerte");
console.log(
	"Share: https://app.brandocean.nl/o/pied-a-terre-offerte?t=" + shareToken,
);
process.exit(res.status ?? 1);
