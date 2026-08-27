import type { JSONContent } from "@tiptap/react";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Downloads the NDA as a clean vector PDF (selectable text, brand fonts).
// The renderer (react-pdf) is loaded on demand so it stays out of the bundle.
export function DownloadPdfButton({
	content,
	filename,
	className,
}: {
	content: JSONContent | null | undefined;
	filename: string;
	className?: string;
}) {
	const [working, setWorking] = useState(false);
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className={className}
			disabled={working || !content}
			onClick={async () => {
				if (!content) return;
				setWorking(true);
				try {
					const { downloadNdaPdf } = await import("./ndaPdf");
					await downloadNdaPdf(content, filename);
				} catch (err) {
					toast.error("Could not create PDF", {
						description: err instanceof Error ? err.message : String(err),
					});
				} finally {
					setWorking(false);
				}
			}}
		>
			<DownloadIcon data-icon="inline-start" />
			{working ? "Preparing…" : "Download PDF"}
		</Button>
	);
}
