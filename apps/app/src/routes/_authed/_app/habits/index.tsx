import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { PencilIcon, PlusIcon, Undo2Icon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/habits/")({
	component: HabitsPage,
});

const MAX_TRACKERS = 6;

const EMPTY_SLOT_KEYS = [
	"slot-1",
	"slot-2",
	"slot-3",
	"slot-4",
	"slot-5",
	"slot-6",
] as const;

const COLORS = {
	emerald: {
		card: "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
		accent: "text-emerald-500",
		swatch: "bg-emerald-500",
	},
	sky: {
		card: "border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10",
		accent: "text-sky-500",
		swatch: "bg-sky-500",
	},
	amber: {
		card: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
		accent: "text-amber-500",
		swatch: "bg-amber-500",
	},
	rose: {
		card: "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10",
		accent: "text-rose-500",
		swatch: "bg-rose-500",
	},
	violet: {
		card: "border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10",
		accent: "text-violet-500",
		swatch: "bg-violet-500",
	},
	zinc: {
		card: "border-zinc-500/30 bg-zinc-500/5 hover:bg-zinc-500/10",
		accent: "text-zinc-400",
		swatch: "bg-zinc-500",
	},
} as const;

type ColorKey = keyof typeof COLORS;

function colorOf(key: string) {
	return COLORS[key as ColorKey] ?? COLORS.zinc;
}

type TrackerRow = Doc<"habitTrackers"> & {
	today: number;
	todayTaps: number;
	week: number;
};

function localDay() {
	return format(new Date(), "yyyy-MM-dd");
}

function HabitsPage() {
	// Local calendar date; refreshed every minute so counts roll over at
	// midnight even when the tab stays open.
	const [day, setDay] = useState(localDay);
	useEffect(() => {
		const t = setInterval(() => setDay(localDay()), 60_000);
		return () => clearInterval(t);
	}, []);

	const trackers = useQuery(api.habits.list, { day });
	const ensureDefaults = useMutation(api.habits.ensureDefaults);
	const seeded = useRef(false);
	useEffect(() => {
		if (trackers !== undefined && trackers.length === 0 && !seeded.current) {
			seeded.current = true;
			void ensureDefaults();
		}
	}, [trackers, ensureDefaults]);

	const tap = useMutation(api.habits.tap).withOptimisticUpdate(
		(store, args) => {
			const current = store.getQuery(api.habits.list, { day: args.day });
			if (!current) return;
			store.setQuery(
				api.habits.list,
				{ day: args.day },
				current.map((t) =>
					t._id === args.trackerId
						? {
								...t,
								today: t.today + t.step,
								todayTaps: t.todayTaps + 1,
								week: t.week + t.step,
								total: t.total + t.step,
							}
						: t,
				),
			);
		},
	);
	const undo = useMutation(api.habits.undo);

	const [editing, setEditing] = useState<TrackerRow | "new" | null>(null);

	const emptySlots = Math.max(0, MAX_TRACKERS - (trackers?.length ?? 0));

	return (
		<Frame className="min-h-0 flex-1">
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Habits</FrameTitle>
					<FrameDescription>
						Tap a button to log it. Hover a card to undo or change its settings.
					</FrameDescription>
				</FrameHeading>
			</FrameHeader>
			<FramePanel className="flex-1">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{(trackers ?? []).map((tracker) => (
						<TrackerCard
							key={tracker._id}
							tracker={tracker}
							onTap={() => void tap({ trackerId: tracker._id, day })}
							onUndo={() => void undo({ trackerId: tracker._id, day })}
							onEdit={() => setEditing(tracker)}
						/>
					))}
					{EMPTY_SLOT_KEYS.slice(0, emptySlots).map((slotKey) => (
						<button
							key={slotKey}
							type="button"
							onClick={() => setEditing("new")}
							className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
						>
							<PlusIcon className="size-5" />
							<span className="text-sm font-medium">Add tracker</span>
						</button>
					))}
				</div>
			</FramePanel>
			{editing !== null ? (
				<TrackerDialog
					tracker={editing === "new" ? null : editing}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</Frame>
	);
}

function TrackerCard({
	tracker,
	onTap,
	onUndo,
	onEdit,
}: {
	tracker: TrackerRow;
	onTap: () => void;
	onUndo: () => void;
	onEdit: () => void;
}) {
	const color = colorOf(tracker.color);
	const unit = tracker.unit?.trim();
	return (
		<div className="group relative">
			<button
				type="button"
				onClick={onTap}
				className={cn(
					"flex min-h-44 w-full flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-5 transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]",
					color.card,
				)}
			>
				<span className="text-3xl leading-none">{tracker.emoji}</span>
				<span
					className={cn(
						"mt-2 text-5xl leading-none font-bold tabular-nums",
						color.accent,
					)}
				>
					{tracker.today}
				</span>
				<span className="mt-1 text-sm font-medium">{tracker.name}</span>
				<span className="text-xs text-muted-foreground">
					+{tracker.step}
					{unit ? ` ${unit}` : ""} per tap
				</span>
				<span className="mt-2 text-[0.6875rem] text-muted-foreground tabular-nums">
					week {tracker.week} · all-time {tracker.total}
				</span>
			</button>
			<div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
				{tracker.todayTaps > 0 ? (
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onUndo}
						aria-label={`Undo last ${tracker.name} tap`}
					>
						<Undo2Icon />
					</Button>
				) : null}
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onEdit}
					aria-label={`Edit ${tracker.name}`}
				>
					<PencilIcon />
				</Button>
			</div>
		</div>
	);
}

function TrackerDialog({
	tracker,
	onClose,
}: {
	tracker: TrackerRow | null;
	onClose: () => void;
}) {
	const uid = useId();
	const create = useMutation(api.habits.create);
	const update = useMutation(api.habits.update);
	const remove = useMutation(api.habits.remove);

	const [name, setName] = useState(tracker?.name ?? "");
	const [emoji, setEmoji] = useState(tracker?.emoji ?? "✅");
	const [step, setStep] = useState(String(tracker?.step ?? 1));
	const [unit, setUnit] = useState(tracker?.unit ?? "");
	const [colorKey, setColorKey] = useState(tracker?.color ?? "emerald");
	const [confirmDelete, setConfirmDelete] = useState(false);

	const save = async () => {
		const fields = {
			name: name.trim() || "Untitled",
			emoji: emoji.trim() || "✅",
			step: Math.max(1, Math.round(Number(step) || 1)),
			unit: unit.trim() === "" ? undefined : unit.trim(),
			color: colorKey,
		};
		if (tracker) await update({ id: tracker._id, ...fields });
		else await create(fields);
		onClose();
	};

	const deleteTracker = async (id: Id<"habitTrackers">) => {
		await remove({ id });
		onClose();
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{tracker ? "Edit tracker" : "New tracker"}</DialogTitle>
					<DialogDescription>
						One tap on the button logs the amount below.
					</DialogDescription>
				</DialogHeader>
				<form
					className="grid gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						void save();
					}}
				>
					<div className="grid grid-cols-[4rem_1fr] gap-3">
						<div className="grid gap-1.5">
							<Label htmlFor={`${uid}-emoji`}>Emoji</Label>
							<Input
								id={`${uid}-emoji`}
								value={emoji}
								onChange={(e) => setEmoji(e.target.value)}
								className="text-center"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor={`${uid}-name`}>Name</Label>
							<Input
								id={`${uid}-name`}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Push-ups"
								autoFocus
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label htmlFor={`${uid}-step`}>Amount per tap</Label>
							<Input
								id={`${uid}-step`}
								type="number"
								min={1}
								value={step}
								onChange={(e) => setStep(e.target.value)}
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor={`${uid}-unit`}>Unit (optional)</Label>
							<Input
								id={`${uid}-unit`}
								value={unit}
								onChange={(e) => setUnit(e.target.value)}
								placeholder="push-ups"
							/>
						</div>
					</div>
					<div className="grid gap-1.5">
						<Label>Color</Label>
						<div className="flex gap-2">
							{(Object.keys(COLORS) as ColorKey[]).map((key) => (
								<button
									key={key}
									type="button"
									onClick={() => setColorKey(key)}
									aria-label={key}
									className={cn(
										"size-6 rounded-full transition-transform hover:scale-110",
										COLORS[key].swatch,
										colorKey === key &&
											"ring-2 ring-ring ring-offset-2 ring-offset-popover",
									)}
								/>
							))}
						</div>
					</div>
					<DialogFooter>
						{tracker ? (
							<Button
								type="button"
								variant="destructive"
								className="sm:mr-auto"
								onClick={() => {
									if (confirmDelete) void deleteTracker(tracker._id);
									else setConfirmDelete(true);
								}}
							>
								{confirmDelete ? "Really delete?" : "Delete"}
							</Button>
						) : null}
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit">Save</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
