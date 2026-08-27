// Build a clean, vector NDA PDF from the TipTap document JSON using
// @react-pdf/renderer. This gives selectable text, the brand fonts, and proper
// automatic page breaks (no mid-line cuts like a rasterized capture).
// Imported dynamically (client-only) so react-pdf stays out of the main bundle.
import {
	Document,
	Font,
	Image,
	Page,
	pdf,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import type { JSONContent } from "@tiptap/react";

let fontsRegistered = false;
function ensureFonts() {
	if (fontsRegistered) return;
	Font.register({
		family: "Host Grotesk",
		fonts: [
			{ src: "/fonts/host-grotesk-400.ttf", fontWeight: 400 },
			{ src: "/fonts/host-grotesk-600.ttf", fontWeight: 600 },
			{ src: "/fonts/host-grotesk-700.ttf", fontWeight: 700 },
		],
	});
	// Disable hyphenation so words are never split with a hyphen.
	Font.registerHyphenationCallback((word) => [word]);
	fontsRegistered = true;
}

const styles = StyleSheet.create({
	page: {
		paddingTop: 54,
		paddingBottom: 64,
		paddingHorizontal: 56,
		fontFamily: "Host Grotesk",
		fontSize: 10.5,
		lineHeight: 1.55,
		color: "#0f172a",
	},
	h1: {
		fontFamily: "Host Grotesk",
		fontWeight: 700,
		fontSize: 24,
		marginBottom: 16,
	},
	h2: {
		fontFamily: "Host Grotesk",
		fontWeight: 700,
		fontSize: 14,
		marginTop: 18,
		marginBottom: 6,
	},
	paragraph: { marginBottom: 9 },
	bold: { fontFamily: "Host Grotesk", fontWeight: 600 },
	bulletRow: { flexDirection: "row", marginBottom: 4, paddingLeft: 6 },
	bulletDot: { width: 14 },
	bulletBody: { flex: 1 },
	signature: { width: 150, marginTop: 14, marginBottom: 6 },
	spacer: { height: 6 },
	footer: {
		position: "absolute",
		bottom: 28,
		left: 56,
		right: 56,
		textAlign: "center",
		fontSize: 8,
		color: "#94a3b8",
	},
});

function isBold(marks: JSONContent["marks"]): boolean {
	return Boolean(marks?.some((m) => m.type === "bold"));
}

function renderInline(nodes: JSONContent[] | undefined) {
	if (!nodes) return null;
	return nodes.map((n, i) => {
		if (n.type !== "text" || !n.text) return null;
		return (
			// biome-ignore lint/suspicious/noArrayIndexKey: static one-shot PDF render
			<Text key={i} style={isBold(n.marks) ? styles.bold : undefined}>
				{n.text}
			</Text>
		);
	});
}

function renderBlock(node: JSONContent, key: number) {
	switch (node.type) {
		case "heading": {
			const level = node.attrs?.level === 1 ? 1 : 2;
			return (
				<View key={key} wrap={false} minPresenceAhead={36}>
					<Text style={level === 1 ? styles.h1 : styles.h2}>
						{renderInline(node.content)}
					</Text>
				</View>
			);
		}
		case "paragraph": {
			if (!node.content || node.content.length === 0)
				return <View key={key} style={styles.spacer} />;
			return (
				<Text key={key} style={styles.paragraph}>
					{renderInline(node.content)}
				</Text>
			);
		}
		case "bulletList":
			return (
				<View key={key}>
					{(node.content ?? []).map((li, liIdx) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static one-shot PDF render
						<View key={liIdx} style={styles.bulletRow} wrap={false}>
							<Text style={styles.bulletDot}>•</Text>
							<View style={styles.bulletBody}>
								{(li.content ?? []).map((p, pIdx) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static one-shot PDF render
									<Text key={pIdx}>{renderInline(p.content)}</Text>
								))}
							</View>
						</View>
					))}
				</View>
			);
		case "image": {
			const src = typeof node.attrs?.src === "string" ? node.attrs.src : null;
			if (!src) return null;
			return (
				<View key={key} wrap={false}>
					<Image src={src} style={styles.signature} />
				</View>
			);
		}
		default:
			return null;
	}
}

function slugifyFilename(input: string): string {
	const base = input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	return base || "nda";
}

export async function downloadNdaPdf(
	content: JSONContent,
	filename: string,
): Promise<void> {
	ensureFonts();
	const blocks = Array.isArray(content.content) ? content.content : [];
	const doc = (
		<Document>
			<Page size="A4" style={styles.page}>
				{blocks.map((node, i) => renderBlock(node, i))}
				<Text
					style={styles.footer}
					render={({ pageNumber, totalPages }) =>
						`${pageNumber} / ${totalPages}`
					}
					fixed
				/>
			</Page>
		</Document>
	);

	const blob = await pdf(doc).toBlob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${slugifyFilename(filename)}.pdf`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
