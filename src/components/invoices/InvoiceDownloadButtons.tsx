import { DownloadIcon, FileCodeIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { InvoiceDocumentData } from "@/lib/invoiceDocument";

// Download de factuur als Moneybird-stijl PDF of als UBL 2.1 e-factuur (met
// ingesloten PDF). Beide renderers worden pas bij de klik geladen, zodat
// react-pdf buiten de hoofdbundel blijft.
export function InvoiceDownloadButtons({
	data,
	className,
}: {
	data: InvoiceDocumentData | null;
	className?: string;
}) {
	const [working, setWorking] = useState<"pdf" | "ubl" | null>(null);

	const run = async (kind: "pdf" | "ubl") => {
		if (!data) return;
		setWorking(kind);
		try {
			if (kind === "pdf") {
				const { downloadInvoicePdf } = await import("./invoicePdf");
				await downloadInvoicePdf(data, `${data.number}.pdf`);
			} else {
				const { downloadUblInvoice } = await import("@/lib/ubl");
				await downloadUblInvoice(data);
			}
		} catch (err) {
			toast.error(
				kind === "pdf" ? "Could not create PDF" : "Could not create UBL",
				{
					description: err instanceof Error ? err.message : String(err),
				},
			);
		} finally {
			setWorking(null);
		}
	};

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className={className}
				disabled={working !== null || !data}
				onClick={() => void run("pdf")}
			>
				<DownloadIcon data-icon="inline-start" />
				{working === "pdf" ? "Preparing…" : "Download PDF"}
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className={className}
				disabled={working !== null || !data}
				onClick={() => void run("ubl")}
			>
				<FileCodeIcon data-icon="inline-start" />
				{working === "ubl" ? "Preparing…" : "Download UBL"}
			</Button>
		</>
	);
}
