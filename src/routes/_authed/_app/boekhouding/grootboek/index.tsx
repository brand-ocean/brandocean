import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { BookOpenCheckIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { type Column, DataTable } from "@/components/app/data-table";
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
import { TonePill } from "@/components/app/tone";
import { CountTabs } from "@/components/app/toolbar";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";
import {
	ACCOUNT_TYPE_LABEL,
	ENTRY_TYPE_LABEL,
	ENTRY_TYPE_TONE,
	toCents,
	todayKey,
} from "../-shared";

export const Route = createFileRoute("/_authed/_app/boekhouding/grootboek/")({
	component: GrootboekPage,
});

function GrootboekPage() {
	const status = useQuery(api.boekhouding.opening.status, {});
	const [tab, setTab] = useState("journaal");
	const [bannerDismissed, setBannerDismissed] = useState(false);

	if (status === undefined) {
		return (
			<Frame>
				<FramePanel>
					<Skeleton className="mb-4 h-8 w-2/3" />
					<Skeleton className="h-40" />
				</FramePanel>
			</Frame>
		);
	}

	if (!status.chartSeeded) {
		return (
			<Frame>
				<FramePanel flush>
					<SeedEmptyState />
				</FramePanel>
			</Frame>
		);
	}

	return (
		<>
			{!status.openingBooked && !bannerDismissed ? (
				<OpeningBanner onDismiss={() => setBannerDismissed(true)} />
			) : null}
			<Frame>
				<FrameHeader>
					<FrameHeading>
						<FrameTitle>Grootboek</FrameTitle>
						<FrameDescription>
							Journaalposten en het rekeningschema van de administratie.
						</FrameDescription>
					</FrameHeading>
					<FrameActions>
						<MemoriaalDialog />
					</FrameActions>
				</FrameHeader>
				<CountTabs
					value={tab}
					onValueChange={setTab}
					tabs={[
						{ id: "journaal", label: "Journaal" },
						{ id: "rekeningen", label: "Rekeningen" },
					]}
				/>
				{tab === "journaal" ? <JournaalTab /> : <RekeningenTab />}
			</Frame>
		</>
	);
}

function SeedEmptyState() {
	const seedChart = useMutation(api.boekhouding.accounts.seedChart);
	const [seeding, setSeeding] = useState(false);

	return (
		<EmptyState
			icon={BookOpenCheckIcon}
			title="Administratie nog niet ingericht"
			description="Maak eerst het Nederlandse rekeningschema aan. Daarna kun je de openingsbalans en journaalposten boeken."
			action={
				<Button
					size="sm"
					disabled={seeding}
					onClick={async () => {
						setSeeding(true);
						try {
							const result = await seedChart({});
							toast.success("Rekeningschema aangemaakt", {
								description: `${result.created} van ${result.total} rekeningen toegevoegd.`,
							});
						} catch (err) {
							toast.error("Rekeningschema aanmaken mislukt", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setSeeding(false);
						}
					}}
				>
					<PlusIcon data-icon="inline-start" />
					{seeding ? "Bezig…" : "Rekeningschema aanmaken"}
				</Button>
			}
		/>
	);
}

function OpeningBanner({ onDismiss }: { onDismiss: () => void }) {
	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Openingsbalans nog niet geboekt</FrameTitle>
					<FrameDescription>
						Boek het gestorte kapitaal zodat de balans klopt vanaf de
						startdatum.
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<OpeningBalanceDialog />
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Melding verbergen"
						onClick={onDismiss}
					>
						<XIcon />
					</Button>
				</FrameActions>
			</FrameHeader>
		</Frame>
	);
}

function OpeningBalanceDialog() {
	const dateId = useId();
	const capitalId = useId();
	const bankId = useId();
	const bookOpening = useMutation(api.boekhouding.opening.bookOpeningBalance);
	const [open, setOpen] = useState(false);
	const [date, setDate] = useState(todayKey);
	const [capital, setCapital] = useState("");
	const [bank, setBank] = useState("");
	const [saving, setSaving] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm" />}>
				Openingsbalans boeken
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Openingsbalans boeken</DialogTitle>
					<DialogDescription>
						Het gestorte kapitaal bij de start van de BV. Laat "waarvan op bank"
						leeg als het volledige bedrag op de bankrekening staat.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						const shareCapitalCents = toCents(capital);
						if (shareCapitalCents <= 0) return;
						setSaving(true);
						try {
							await bookOpening({
								date,
								shareCapitalCents,
								...(bank.trim() === "" ? {} : { bankCents: toCents(bank) }),
							});
							toast.success("Openingsbalans geboekt");
							setOpen(false);
						} catch (err) {
							toast.error("Openingsbalans boeken mislukt", {
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
							<FieldLabel htmlFor={dateId}>Datum</FieldLabel>
							<Input
								id={dateId}
								type="date"
								value={date}
								onChange={(e) => setDate(e.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={capitalId}>Gestort kapitaal (€)</FieldLabel>
							<Input
								id={capitalId}
								type="number"
								min="0"
								step="0.01"
								value={capital}
								onChange={(e) => setCapital(e.target.value)}
								placeholder="100,00"
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={bankId}>
								Waarvan op bank (€, optioneel)
							</FieldLabel>
							<Input
								id={bankId}
								type="number"
								min="0"
								step="0.01"
								value={bank}
								onChange={(e) => setBank(e.target.value)}
								placeholder="Volledig bedrag"
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Annuleren
						</DialogClose>
						<Button type="submit" disabled={saving || toCents(capital) <= 0}>
							{saving ? "Boeken…" : "Boeken"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function JournaalTab() {
	const navigate = useNavigate();
	const {
		results,
		status: pageStatus,
		loadMore,
	} = usePaginatedQuery(
		api.boekhouding.journal.listEntries,
		{},
		{ initialNumItems: 50 },
	);

	const columns: readonly Column<Doc<"journalEntries">>[] = useMemo(
		() => [
			{
				id: "number",
				header: "#",
				sortValue: (r) => r.entryNumber,
				cell: (r) => (
					<span className="font-medium tabular-nums">{r.entryNumber}</span>
				),
			},
			{
				id: "date",
				header: "Datum",
				sortValue: (r) => r.date,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{formatDate(r.date)}
					</span>
				),
			},
			{
				id: "description",
				header: "Omschrijving",
				sortValue: (r) => r.description,
				cell: (r) => <span className="truncate">{r.description}</span>,
			},
			{
				id: "type",
				header: "Type",
				sortValue: (r) => r.type,
				cell: (r) => (
					<TonePill dot tone={ENTRY_TYPE_TONE[r.type]}>
						{ENTRY_TYPE_LABEL[r.type]}
					</TonePill>
				),
			},
			{
				id: "total",
				header: "Bedrag",
				align: "right",
				sortValue: (r) => r.totalCents,
				cell: (r) => (
					<span className="font-medium tabular-nums">
						{formatCurrency(r.totalCents)}
					</span>
				),
			},
		],
		[],
	);

	return (
		<>
			<DataTable
				rows={results}
				columns={columns}
				getRowKey={(r) => r._id}
				loading={pageStatus === "LoadingFirstPage"}
				paginate={false}
				noun="journaalposten"
				renderRow={(row, cells) => (
					<TableRow
						className="cursor-pointer"
						onClick={() =>
							void navigate({
								to: "/boekhouding/grootboek/$entryId",
								params: { entryId: row._id },
							})
						}
					>
						{cells}
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={BookOpenCheckIcon}
						title="Nog geen journaalposten"
						description="Boek de openingsbalans of maak een memoriaalboeking om te beginnen."
					/>
				}
			/>
			{pageStatus === "CanLoadMore" || pageStatus === "LoadingMore" ? (
				<FrameFooter className="justify-center">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={pageStatus === "LoadingMore"}
						onClick={() => loadMore(50)}
					>
						{pageStatus === "LoadingMore" ? "Laden…" : "Laad meer"}
					</Button>
				</FrameFooter>
			) : null}
		</>
	);
}

type MemoLine = {
	key: number;
	accountId: string;
	debit: string;
	credit: string;
	description: string;
};

let memoLineKey = 0;

function newMemoLine(): MemoLine {
	memoLineKey += 1;
	return {
		key: memoLineKey,
		accountId: "",
		debit: "",
		credit: "",
		description: "",
	};
}

function MemoriaalDialog() {
	const dateId = useId();
	const descriptionId = useId();
	const accounts = useQuery(api.boekhouding.accounts.list, {});
	const createMemoriaal = useMutation(api.boekhouding.journal.createMemoriaal);
	const [open, setOpen] = useState(false);
	const [date, setDate] = useState(todayKey);
	const [description, setDescription] = useState("");
	const [lines, setLines] = useState<MemoLine[]>(() => [
		newMemoLine(),
		newMemoLine(),
	]);
	const [saving, setSaving] = useState(false);

	const totalDebit = lines.reduce((acc, l) => acc + toCents(l.debit), 0);
	const totalCredit = lines.reduce((acc, l) => acc + toCents(l.credit), 0);
	const linesValid = lines.every(
		(l) => l.accountId !== "" && toCents(l.debit) > 0 !== toCents(l.credit) > 0,
	);
	const balanced =
		totalDebit === totalCredit &&
		totalDebit > 0 &&
		lines.length >= 2 &&
		linesValid;

	const patchLine = (key: number, patch: Partial<MemoLine>) => {
		setLines((prev) =>
			prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
		);
	};

	const reset = () => {
		setDate(todayKey());
		setDescription("");
		setLines([newMemoLine(), newMemoLine()]);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm" />}>
				<PlusIcon data-icon="inline-start" />
				Memoriaal
			</DialogTrigger>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Memoriaalboeking</DialogTitle>
					<DialogDescription>
						Handmatige journaalpost. Debet en credit moeten in balans zijn.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!balanced || !description.trim()) return;
						setSaving(true);
						try {
							await createMemoriaal({
								date,
								description: description.trim(),
								lines: lines.map((l) => ({
									accountId: l.accountId as Id<"ledgerAccounts">,
									debitCents: toCents(l.debit),
									creditCents: toCents(l.credit),
									...(l.description.trim() === ""
										? {}
										: { description: l.description.trim() }),
								})),
							});
							toast.success("Memoriaal geboekt");
							reset();
							setOpen(false);
						} catch (err) {
							toast.error("Memoriaal boeken mislukt", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setSaving(false);
						}
					}}
					className="space-y-6"
				>
					<FieldGroup>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<Field>
								<FieldLabel htmlFor={dateId}>Datum</FieldLabel>
								<Input
									id={dateId}
									type="date"
									value={date}
									onChange={(e) => setDate(e.target.value)}
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={descriptionId}>Omschrijving</FieldLabel>
								<Input
									id={descriptionId}
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Bijv. correctie afschrijving"
									required
								/>
							</Field>
						</div>
					</FieldGroup>

					<div className="space-y-2">
						{lines.map((line, index) => (
							<div
								key={line.key}
								className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,2fr)_110px_110px_minmax(0,1.5fr)_32px]"
							>
								<Select
									value={line.accountId}
									onValueChange={(v) =>
										patchLine(line.key, { accountId: v ?? "" })
									}
								>
									<SelectTrigger aria-label={`Rekening regel ${index + 1}`}>
										<SelectValue placeholder="Rekening…" />
									</SelectTrigger>
									<SelectContent>
										{(accounts ?? []).map((a) => (
											<SelectItem key={a._id} value={a._id}>
												{a.code} · {a.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Input
									type="number"
									min="0"
									step="0.01"
									value={line.debit}
									onChange={(e) =>
										patchLine(line.key, { debit: e.target.value })
									}
									placeholder="Debet €"
									aria-label={`Debet regel ${index + 1}`}
								/>
								<Input
									type="number"
									min="0"
									step="0.01"
									value={line.credit}
									onChange={(e) =>
										patchLine(line.key, { credit: e.target.value })
									}
									placeholder="Credit €"
									aria-label={`Credit regel ${index + 1}`}
								/>
								<Input
									value={line.description}
									onChange={(e) =>
										patchLine(line.key, { description: e.target.value })
									}
									placeholder="Omschrijving (optioneel)"
									aria-label={`Omschrijving regel ${index + 1}`}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={`Regel ${index + 1} verwijderen`}
									disabled={lines.length <= 2}
									onClick={() =>
										setLines((prev) => prev.filter((l) => l.key !== line.key))
									}
								>
									<Trash2Icon />
								</Button>
							</div>
						))}
						<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setLines((prev) => [...prev, newMemoLine()])}
							>
								<PlusIcon data-icon="inline-start" />
								Regel toevoegen
							</Button>
							<div className="flex items-center gap-3 text-sm">
								<span className="text-muted-foreground tabular-nums">
									Debet {formatCurrency(totalDebit)} · Credit{" "}
									{formatCurrency(totalCredit)}
								</span>
								{totalDebit > 0 || totalCredit > 0 ? (
									<TonePill dot tone={balanced ? "success" : "warning"}>
										{balanced ? "In balans" : "Niet in balans"}
									</TonePill>
								) : null}
							</div>
						</div>
					</div>

					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Annuleren
						</DialogClose>
						<Button
							type="submit"
							disabled={saving || !balanced || !description.trim()}
						>
							{saving ? "Boeken…" : "Boeken"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function RekeningenTab() {
	const accounts = useQuery(api.boekhouding.accounts.list, {
		includeInactive: true,
	});

	const columns: readonly Column<Doc<"ledgerAccounts">>[] = useMemo(
		() => [
			{
				id: "code",
				header: "Code",
				sortValue: (r) => r.code,
				cell: (r) => <span className="font-medium tabular-nums">{r.code}</span>,
			},
			{
				id: "name",
				header: "Naam",
				sortValue: (r) => r.name,
				cell: (r) => (
					<div className="flex min-w-0 items-center gap-2">
						<span className="truncate">{r.name}</span>
						{r.isSystem ? (
							<TonePill size="sm" tone="muted">
								Systeem
							</TonePill>
						) : null}
					</div>
				),
			},
			{
				id: "type",
				header: "Type",
				sortValue: (r) => r.type,
				cell: (r) => (
					<span className="text-muted-foreground">
						{ACCOUNT_TYPE_LABEL[r.type]}
					</span>
				),
			},
			{
				id: "active",
				header: "Actief",
				sortValue: (r) => (r.active ? 1 : 0),
				cell: (r) => (
					<TonePill dot tone={r.active ? "success" : "muted"}>
						{r.active ? "Actief" : "Inactief"}
					</TonePill>
				),
			},
		],
		[],
	);

	return (
		<DataTable
			rows={accounts ?? []}
			columns={columns}
			getRowKey={(r) => r._id}
			loading={accounts === undefined}
			paginate={false}
			noun="rekeningen"
			defaultSort={{ id: "code", dir: "asc" }}
			empty={
				<EmptyState
					icon={BookOpenCheckIcon}
					title="Geen rekeningen"
					description="Het rekeningschema is nog leeg."
				/>
			}
		/>
	);
}
