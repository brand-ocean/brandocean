import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MessageCircleQuestionIcon, PlusIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { type Column, DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FrameTitle,
} from "@/components/app/frame";
import { type Tone, TonePill } from "@/components/app/tone";
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
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/specs/")({
	component: SpecsList,
});

type Row = {
	_id: Id<"specs">;
	title: string;
	clientName: string | null;
	published: boolean;
	total: number;
	answered: number;
	openBlocking: number;
	updatedAt: number;
};

function state(row: Row): { label: string; tone: Tone } {
	if (!row.published) return { label: "Concept", tone: "muted" };
	if (row.openBlocking > 0)
		return { label: `${row.openBlocking} blokkeren`, tone: "warning" };
	if (row.total > 0 && row.answered === row.total)
		return { label: "Compleet", tone: "success" };
	return { label: "Verstuurd", tone: "info" };
}

function SpecsList() {
	const specs = useQuery(api.specs.listByOwner, {});
	const clients = useQuery(api.clients.list);
	const navigate = useNavigate();

	const clientName = useMemo(
		() => new Map((clients ?? []).map((c) => [c._id, c.name])),
		[clients],
	);

	const rows: Row[] = useMemo(
		() =>
			(specs ?? []).map((s) => ({
				_id: s._id,
				title: s.title,
				clientName: s.clientId ? (clientName.get(s.clientId) ?? null) : null,
				published: s.published,
				total: s.total,
				answered: s.answered,
				openBlocking: s.openBlocking,
				updatedAt: s.updatedAt,
			})),
		[specs, clientName],
	);

	const columns: readonly Column<Row>[] = useMemo(
		() => [
			{
				id: "title",
				header: "Lijst",
				sortValue: (r) => r.title.toLowerCase(),
				cell: (r) => <span className="font-medium">{r.title}</span>,
			},
			{
				id: "client",
				header: "Klant",
				sortValue: (r) => (r.clientName ?? "").toLowerCase(),
				cell: (r) => (
					<span className={r.clientName ? "" : "text-muted-foreground"}>
						{r.clientName ?? "—"}
					</span>
				),
			},
			{
				id: "answered",
				header: "Beantwoord",
				sortValue: (r) => (r.total === 0 ? 0 : r.answered / r.total),
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{r.answered} / {r.total}
					</span>
				),
			},
			{
				id: "status",
				header: "Status",
				sortValue: (r) => state(r).label,
				cell: (r) => {
					const s = state(r);
					return (
						<TonePill dot tone={s.tone}>
							{s.label}
						</TonePill>
					);
				},
			},
			{
				id: "updated",
				header: "Bijgewerkt",
				align: "right",
				sortValue: (r) => r.updatedAt,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{new Date(r.updatedAt).toLocaleDateString("nl-NL")}
					</span>
				),
			},
		],
		[],
	);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Vragen</FrameTitle>
					<FrameDescription>
						Genummerde vragen die je deelt met een klant. Zij antwoorden per
						punt.
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<NewSpecDialog />
				</FrameActions>
			</FrameHeader>
			<DataTable
				rows={rows}
				columns={columns}
				getRowKey={(r) => r._id}
				loading={specs === undefined}
				noun="lijsten"
				defaultSort={{ id: "updated", dir: "desc" }}
				renderRow={(row, cells) => (
					<TableRow
						className="cursor-pointer"
						onClick={() =>
							void navigate({
								to: "/specs/$specId",
								params: { specId: row._id },
							})
						}
					>
						{cells}
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={MessageCircleQuestionIcon}
						title="Nog geen vragenlijst"
						description="Zet je open punten op een rij en stuur de klant één link."
						action={<NewSpecDialog />}
					/>
				}
			/>
		</Frame>
	);
}

function NewSpecDialog() {
	const titleId = useId();
	const clientId = useId();
	const createSpec = useMutation(api.specs.create);
	const clients = useQuery(api.clients.list);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [client, setClient] = useState<string>("none");
	const [creating, setCreating] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		if (!title.trim()) return;
		setCreating(true);
		try {
			const id = await createSpec({
				title: title.trim(),
				clientId: client === "none" ? undefined : (client as Id<"clients">),
			});
			setOpen(false);
			setTitle("");
			setClient("none");
			await navigate({ to: "/specs/$specId", params: { specId: id } });
		} catch (err) {
			toast.error("Aanmaken mislukt", {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			setCreating(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setTitle("");
			}}
		>
			<DialogTrigger render={<Button size="sm" />}>
				<PlusIcon data-icon="inline-start" />
				Nieuwe lijst
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Nieuwe vragenlijst</DialogTitle>
					<DialogDescription>
						Waar gaan de vragen over? De titel kun je later aanpassen.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={titleId}>Titel</FieldLabel>
							<Input
								id={titleId}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Placements"
								autoFocus
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={clientId}>Klant</FieldLabel>
							<Select
								value={client}
								onValueChange={(value) => setClient(value ?? "none")}
							>
								<SelectTrigger id={clientId}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Geen klant</SelectItem>
									{(clients ?? []).map((c) => (
										<SelectItem key={c._id} value={c._id}>
											{c.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>
					<DialogFooter className="mt-4">
						<DialogClose render={<Button type="button" variant="ghost" />}>
							Annuleren
						</DialogClose>
						<Button type="submit" disabled={creating || !title.trim()}>
							Aanmaken
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
