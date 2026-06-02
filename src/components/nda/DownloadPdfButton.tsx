import { DownloadIcon } from "lucide-react";
import type { RefObject } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadElementAsPdf } from "./ndaPdf";

// Downloads the referenced element as a clean PDF file (no print dialog).
export function DownloadPdfButton({
	targetRef,
	filename,
	className,
}: {
	targetRef: RefObject<HTMLElement | null>;
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
			disabled={working}
			onClick={async () => {
				const el = targetRef.current;
				if (!el) {
					toast.error("Nothing to export yet");
					return;
				}
				setWorking(true);
				try {
					await downloadElementAsPdf(el, filename);
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
