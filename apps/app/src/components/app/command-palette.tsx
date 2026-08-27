import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	ChartColumnIcon,
	FileTextIcon,
	GaugeIcon,
	ImageIcon,
	LandmarkIcon,
	LayoutDashboardIcon,
	ListChecksIcon,
	MessageSquareIcon,
	MoonIcon,
	ReceiptIcon,
	SettingsIcon,
	ShieldCheckIcon,
	SunIcon,
	UsersIcon,
} from "lucide-react";
import * as React from "react";

import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { useTheme } from "@/context/ThemeContext";
import { api } from "~convex/_generated/api";

type Destination =
	| "/dashboard"
	| "/offertes"
	| "/ndas"
	| "/clients"
	| "/invoices"
	| "/billing"
	| "/boekhouding/grootboek"
	| "/boekhouding/rapporten"
	| "/tasks"
	| "/feedback"
	| "/portfolio"
	| "/settings";

const PAGES: readonly {
	to: Destination;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}[] = [
	{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
	{ to: "/offertes", label: "Offertes", icon: FileTextIcon },
	{ to: "/ndas", label: "NDAs", icon: ShieldCheckIcon },
	{ to: "/clients", label: "Clients", icon: UsersIcon },
	{ to: "/invoices", label: "Invoices", icon: ReceiptIcon },
	{ to: "/billing", label: "Usage billing", icon: GaugeIcon },
	{ to: "/boekhouding/grootboek", label: "Grootboek", icon: LandmarkIcon },
	{ to: "/boekhouding/rapporten", label: "Rapporten", icon: ChartColumnIcon },
	{ to: "/tasks", label: "Tasks", icon: ListChecksIcon },
	{ to: "/feedback", label: "Feedback", icon: MessageSquareIcon },
	{ to: "/portfolio", label: "Portfolio", icon: ImageIcon },
	{ to: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * ⌘K palette. Jumps between sections and straight into any offerte, NDA or
 * invoice by name, so the sidebar never has to grow a list of records.
 */
export function CommandPalette({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (next: boolean) => void;
}) {
	const navigate = useNavigate();
	const { theme, toggleTheme } = useTheme();
	// Only fetch the record lists while the palette is actually open.
	const offertes = useQuery(api.offertes.listByOwner, open ? {} : "skip");
	const ndas = useQuery(api.ndas.listByOwner, open ? {} : "skip");
	const invoices = useQuery(api.invoices.listByOwner, open ? {} : "skip");

	const run = (fn: () => void) => {
		onOpenChange(false);
		fn();
	};

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange}>
			<Command>
				<CommandInput placeholder="Search pages, offertes, invoices…" />
				<CommandList>
					<CommandEmpty>Nothing matched that.</CommandEmpty>
					<CommandGroup heading="Go to">
						{PAGES.map((p) => (
							<CommandItem
								key={p.to}
								value={`page ${p.label}`}
								onSelect={() => run(() => void navigate({ to: p.to }))}
							>
								<p.icon className="size-4" />
								{p.label}
							</CommandItem>
						))}
					</CommandGroup>

					{offertes && offertes.length > 0 ? (
						<>
							<CommandSeparator />
							<CommandGroup heading="Offertes">
								{offertes.slice(0, 8).map((o) => (
									<CommandItem
										key={o._id}
										value={`offerte ${o.title}`}
										onSelect={() =>
											run(
												() =>
													void navigate({
														to: "/offertes/$offerteId",
														params: { offerteId: o._id },
													}),
											)
										}
									>
										<FileTextIcon className="size-4" />
										{o.title}
									</CommandItem>
								))}
							</CommandGroup>
						</>
					) : null}

					{ndas && ndas.length > 0 ? (
						<>
							<CommandSeparator />
							<CommandGroup heading="NDAs">
								{ndas.slice(0, 8).map((n) => (
									<CommandItem
										key={n._id}
										value={`nda ${n.title}`}
										onSelect={() =>
											run(
												() =>
													void navigate({
														to: "/ndas/$ndaId",
														params: { ndaId: n._id },
													}),
											)
										}
									>
										<ShieldCheckIcon className="size-4" />
										{n.title}
									</CommandItem>
								))}
							</CommandGroup>
						</>
					) : null}

					{invoices && invoices.length > 0 ? (
						<>
							<CommandSeparator />
							<CommandGroup heading="Invoices">
								{invoices.slice(0, 8).map((inv) => (
									<CommandItem
										key={inv._id}
										value={`invoice ${inv.number}`}
										onSelect={() =>
											run(
												() =>
													void navigate({
														to: "/invoices/$invoiceId",
														params: { invoiceId: inv._id },
													}),
											)
										}
									>
										<ReceiptIcon className="size-4" />
										{inv.number}
									</CommandItem>
								))}
							</CommandGroup>
						</>
					) : null}

					<CommandSeparator />
					<CommandGroup heading="Preferences">
						<CommandItem
							value="toggle theme dark light"
							onSelect={() => run(toggleTheme)}
						>
							{theme === "light" ? (
								<MoonIcon className="size-4" />
							) : (
								<SunIcon className="size-4" />
							)}
							{theme === "light" ? "Switch to dark" : "Switch to light"}
							<CommandShortcut>⌘J</CommandShortcut>
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
		</CommandDialog>
	);
}

/** Wires ⌘K / ctrl+K to a boolean, shared by the sidebar button and header. */
export function useCommandPalette() {
	const [open, setOpen] = React.useState(false);

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((v) => !v);
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	return { open, setOpen };
}
