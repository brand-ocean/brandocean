import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Undo2Icon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameFooter,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { usePageTitle } from "@/components/app/page-title";
import { TonePill } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";
import { ENTRY_TYPE_LABEL, ENTRY_TYPE_TONE, todayKey } from "../-shared";

export const Route = createFileRoute(
	"/_authed/_app/boekhouding/grootboek/$entryId",
)({
	component: EntryDetailPage,
});

function EntryDetailPage() {
	const { entryId } = Route.useParams();
	const id = entryId as Id<"journalEntries">;
	const data = useQuery(api.boekhouding.journal.getEntry, { id });
	usePageTitle(data?.entry ? `Post #${data.entry.entryNumber}` : null);

	if (data === undefined) {
		return (
			<Frame className="mx-auto w-full max-w-4xl">
				<FramePanel>
					<Skeleton className="mb-4 h-8 w-2/3" />
					<Skeleton className="h-40" />
				</FramePanel>
			</Frame>
		);
	}

	if (data === null) {
		return (
			<Frame className="mx-auto w-full max-w-4xl">
				<FramePanel flush>
					<EmptyState
						title="Journaalpost niet gevonden"
						description="De post bestaat niet meer, of je hebt er geen toegang toe."
						action={
							<Button
								size="sm"
								variant="outline"
								render={<Link to="/boekhouding/grootboek" />}
							>
								Terug naar het grootboek
							</Button>
						}
					/>
				</FramePanel>
			</Frame>
		);
	}

	const { entry, lines } = data;
	const totalDebit = lines.reduce((acc, l) => acc + l.debitCents, 0);
	const totalCredit = lines.reduce((acc, l) => acc + l.creditCents, 0);
	const reversed = entry.reversedByEntryId !== undefined;
	const reversible = !reversed && entry.type !== "reversal";

	return (
		<Frame className="mx-auto w-full max-w-4xl">
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Post #{entry.entryNumber}</FrameTitle>
					<FrameDescription>
						{formatDate(entry.date)} · {entry.description}
					</FrameDescription>
				</FrameHeading>
				<FrameActions className="flex-wrap">
					<TonePill dot tone={ENTRY_TYPE_TONE[entry.type]}>
						{ENTRY_TYPE_LABEL[entry.type]}
					</TonePill>
					{reversed ? (
						<TonePill dot tone="warning">
							Tegengeboekt
						</TonePill>
					) : null}
					{reversible ? <ReverseDialog entryId={entry._id} /> : null}
				</FrameActions>
			</FrameHeader>
			<FramePanel flush>
				<table className="w-full text-sm">
					<thead className="text-left text-xs text-muted-foreground [&_th]:border-b">
						<tr>
							<th className="px-4 py-3">Rekening</th>
							<th className="px-4 py-3">Omschrijving</th>
							<th className="px-4 py-3 w-28">BTW</th>
							<th className="px-4 py-3 w-32 text-right">Debet</th>
							<th className="px-4 py-3 w-32 text-right">Credit</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{lines.map((line) => (
							<tr key={line._id}>
								<td className="px-4 py-3">
									<span className="font-medium tabular-nums">
										{line.accountCode}
									</span>{" "}
									<span className="text-muted-foreground">
										{line.accountName}
									</span>
								</td>
								<td className="px-4 py-3 text-muted-foreground">
									{line.description ?? "—"}
								</td>
								<td className="px-4 py-3 text-muted-foreground">
									{line.vatCategory ?? "—"}
								</td>
								<td className="px-4 py-3 text-right tabular-nums">
									{line.debitCents > 0 ? formatCurrency(line.debitCents) : "—"}
								</td>
								<td className="px-4 py-3 text-right tabular-nums">
									{line.creditCents > 0
										? formatCurrency(line.creditCents)
										: "—"}
								</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr className="border-t font-medium">
							<td className="px-4 py-3" colSpan={3}>
								Totaal
							</td>
							<td className="px-4 py-3 text-right tabular-nums">
								{formatCurrency(totalDebit)}
							</td>
							<td className="px-4 py-3 text-right tabular-nums">
								{formatCurrency(totalCredit)}
							</td>
						</tr>
					</tfoot>
				</table>
			</FramePanel>
			<FrameFooter>
				<span className="font-mono text-muted-foreground">
					{entry.sourceKey}
				</span>
			</FrameFooter>
		</Frame>
	);
}

function ReverseDialog({ entryId }: { entryId: Id<"journalEntries"> }) {
	const dateId = useId();
	const reverse = useMutation(api.boekhouding.journal.reverse);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [date, setDate] = useState(todayKey);
	const [saving, setSaving] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm" variant="outline" />}>
				<Undo2Icon data-icon="inline-start" />
				Tegenboeken
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Post tegenboeken</DialogTitle>
					<DialogDescription>
						Er wordt een spiegelboeking gemaakt die deze post neutraliseert. De
						oorspronkelijke post blijft bestaan.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						setSaving(true);
						try {
							await reverse({ entryId, date });
							toast.success("Post tegengeboekt");
							setOpen(false);
							void navigate({ to: "/boekhouding/grootboek" });
						} catch (err) {
							toast.error("Tegenboeken mislukt", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setSaving(false);
						}
					}}
					className="space-y-6"
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={dateId}>Datum tegenboeking</FieldLabel>
							<Input
								id={dateId}
								type="date"
								value={date}
								onChange={(e) => setDate(e.target.value)}
								required
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Annuleren
						</DialogClose>
						<Button type="submit" disabled={saving}>
							{saving ? "Boeken…" : "Tegenboeken"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
