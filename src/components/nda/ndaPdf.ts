// Render a DOM element to a clean, downloadable A4 PDF (no print dialog).
// html2canvas-pro is used instead of classic html2canvas because Tailwind v4
// emits oklch() colors, which the classic library cannot parse.
// Both libraries are imported dynamically so they stay out of the main bundle
// and never run during SSR.

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

export async function downloadElementAsPdf(
	element: HTMLElement,
	filenameBase: string,
): Promise<void> {
	const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
		import("html2canvas-pro"),
		import("jspdf"),
	]);

	const canvas = await html2canvas(element, {
		scale: 2,
		backgroundColor: "#ffffff",
		useCORS: true,
		logging: false,
	});

	const pdf = new jsPDF({ unit: "pt", format: "a4" });
	const pageWidth = pdf.internal.pageSize.getWidth();
	const pageHeight = pdf.internal.pageSize.getHeight();
	const margin = 40;
	const contentWidth = pageWidth - margin * 2;
	const contentHeight = pageHeight - margin * 2;

	// Scale the captured bitmap to the printable column width, then page it.
	const imgWidth = contentWidth;
	const imgHeight = (canvas.height * imgWidth) / canvas.width;
	const imgData = canvas.toDataURL("image/png");

	let heightLeft = imgHeight;
	let position = margin;
	pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
	heightLeft -= contentHeight;

	while (heightLeft > 0) {
		pdf.addPage();
		// Shift the same image up so the next slice lands on the new page.
		position = margin - (imgHeight - heightLeft);
		pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
		heightLeft -= contentHeight;
	}

	pdf.save(`${slugifyFilename(filenameBase)}.pdf`);
}
