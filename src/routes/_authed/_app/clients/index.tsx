import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { BuildingIcon, MailIcon, PlusIcon, UsersIcon } from "lucide-react";
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
import { TonePill } from "@/components/app/tone";
import { ToolbarSearch } from "@/components/app/toolbar";
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
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/clients/")({
	component: ClientsPage,
});

type Row = {
	_id: Id<"clients">;
	name: string;
	email?: string;
	companyName?: string;
	offerteCount: number;
};

function initials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function ClientsPage() {
	const clients = useQuery(api.clients.listWithCounts);
	const navigate = useNavigate();
	const [q, setQ] = useState("");

	const rows: Row[] = useMemo(() => clients ?? [], [clients]);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return rows;
		return rows.filter(
			(c) =>
				c.name.toLowerCase().includes(term) ||
				(c.companyName ?? "").toLowerCase().includes(term) ||
				(c.email ?? "").toLowerCase().includes(term),
		);
	}, [rows, q]);

	const columns: readonly Column<Row>[] = useMemo(
		() => [
			{
				id: "name",
				header: "Client",
				sortValue: (r) => r.name,
				cell: (r) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.625rem] font-semibold text-secondary-foreground">
							{initials(r.name)}
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{r.name}</span>
							{r.companyName ? (
								<span className="truncate text-xs text-muted-foreground">
									{r.companyName}
								</span>
							) : null}
						</div>
					</div>
				),
			},
			{
				id: "email",
				header: "Email",
				sortValue: (r) => r.email ?? "",
				cell: (r) =>
					r.email ? (
						<span className="flex items-center gap-1.5 text-muted-foreground">
							<MailIcon className="size-3.5" />
							{r.email}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					),
			},
			{
				id: "company",
				header: "Company",
				sortValue: (r) => r.companyName ?? "",
				cell: (r) =>
					r.companyName ? (
						<span className="flex items-center gap-1.5 text-muted-foreground">
							<BuildingIcon className="size-3.5" />
							{r.companyName}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					),
			},
			{
				id: "offertes",
				header: "Offertes",
				align: "right",
				sortValue: (r) => r.offerteCount,
				cell: (r) => (
					<TonePill tone={r.offerteCount > 0 ? "info" : "muted"}>
						{r.offerteCount}
					</TonePill>
				),
			},
		],
		[],
	);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Clients</FrameTitle>
					<FrameDescription>
						Everyone you send offertes, NDAs and invoices to.
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<ToolbarSearch
						value={q}
						onValueChange={setQ}
						placeholder="Search clients…"
					/>
					<NewClientDialog />
				</FrameActions>
			</FrameHeader>
			<DataTable
				rows={filtered}
				columns={columns}
				getRowKey={(r) => r._id}
				loading={clients === undefined}
				noun="clients"
				defaultSort={{ id: "name", dir: "asc" }}
				renderRow={(row, cells) => (
					<TableRow
						className="cursor-pointer"
						onClick={() =>
							void navigate({
								to: "/clients/$clientId",
								params: { clientId: row._id },
							})
						}
					>
						{cells}
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={UsersIcon}
						title={q ? "No client matched that" : "No clients yet"}
						description={
							q
								? "Try a different name, company or email."
								: "Add the people and companies you work with."
						}
						action={q ? null : <NewClientDialog />}
					/>
				}
			/>
		</Frame>
	);
}

function NewClientDialog() {
	const nameId = useId();
	const companyId = useId();
	const emailId = useId();
	const create = useMutation(api.clients.create);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [email, setEmail] = useState("");
	const [creating, setCreating] = useState(false);

	const reset = () => {
		setName("");
		setCompanyName("");
		setEmail("");
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) reset();
			}}
		>
			<DialogTrigger render={<Button size="sm" />}>
				<PlusIcon data-icon="inline-start" />
				New client
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a client</DialogTitle>
					<DialogDescription>
						You can edit details and link offertes after.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!name.trim()) return;
						setCreating(true);
						try {
							const id = await create({
								name: name.trim(),
								companyName: companyName.trim() || undefined,
								email: email.trim() || undefined,
							});
							setOpen(false);
							reset();
							navigate({
								to: "/clients/$clientId",
								params: { clientId: id },
							});
						} catch (err) {
							toast.error("Could not create client", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setCreating(false);
						}
					}}
					className="space-y-6"
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Jane van der Berg"
								autoFocus
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={companyId}>Company (optional)</FieldLabel>
							<Input
								id={companyId}
								value={companyName}
								onChange={(e) => setCompanyName(e.target.value)}
								placeholder="EAVE Cosmetics"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={emailId}>Email (optional)</FieldLabel>
							<Input
								id={emailId}
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="jane@company.com"
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Cancel
						</DialogClose>
						<Button type="submit" disabled={creating || !name.trim()}>
							{creating ? "Creating…" : "Create client"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
