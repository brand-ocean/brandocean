import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/context/ThemeContext";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_authed/_app/settings/")({
	component: SettingsPage,
});

function SettingsPage() {
	const settings = useQuery(api.userSettings.get);

	return (
		<div className="mx-auto w-full max-w-3xl space-y-10">
			<header className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
				<p className="text-base text-muted-foreground">
					Workspace, branding, billing defaults.
				</p>
			</header>
			{settings === undefined ? (
				<Skeleton className="h-64" />
			) : (
				<Tabs defaultValue="workspace">
					<TabsList>
						<TabsTrigger value="workspace">Workspace</TabsTrigger>
						<TabsTrigger value="appearance">Appearance</TabsTrigger>
						<TabsTrigger value="billing">Billing defaults</TabsTrigger>
					</TabsList>
					<TabsContent value="workspace" className="pt-6">
						<WorkspaceForm settings={settings} />
					</TabsContent>
					<TabsContent value="appearance" className="pt-6">
						<AppearanceForm settings={settings} />
					</TabsContent>
					<TabsContent value="billing" className="pt-6">
						<BillingForm settings={settings} />
					</TabsContent>
				</Tabs>
			)}
		</div>
	)
}

type Settings = ReturnType<typeof useQuery<typeof api.userSettings.get>>;

function WorkspaceForm({ settings }: { settings: Settings }) {
	const update = useMutation(api.userSettings.update);
	const [businessName, setBusinessName] = useState(
		settings?.businessName ?? "",
	)
	const [businessAddress, setBusinessAddress] = useState(
		settings?.businessAddress ?? "",
	)
	const [vatNumber, setVatNumber] = useState(settings?.vatNumber ?? "");
	const [kvkNumber, setKvkNumber] = useState(settings?.kvkNumber ?? "");
	const [saving, setSaving] = useState(false);

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				setSaving(true);
				try {
					await update({
						businessName: businessName.trim() || undefined,
						businessAddress: businessAddress.trim() || undefined,
						vatNumber: vatNumber.trim() || undefined,
						kvkNumber: kvkNumber.trim() || undefined,
					})
					toast.success("Saved");
				} catch (err) {
					toast.error("Could not save", {
						description: err instanceof Error ? err.message : String(err),
					})
				} finally {
					setSaving(false);
				}
			}}
			className="space-y-6"
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="business-name">Business name</FieldLabel>
					<Input
						id="business-name"
						value={businessName}
						onChange={(e) => setBusinessName(e.target.value)}
						placeholder="BRANDOCEAN"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="business-address">Business address</FieldLabel>
					<Input
						id="business-address"
						value={businessAddress}
						onChange={(e) => setBusinessAddress(e.target.value)}
						placeholder="Street, City, Country"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="vat">BTW-nummer (VAT)</FieldLabel>
					<Input
						id="vat"
						value={vatNumber}
						onChange={(e) => setVatNumber(e.target.value)}
						placeholder="NL000000000B00"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="kvk">KVK-nummer</FieldLabel>
					<Input
						id="kvk"
						value={kvkNumber}
						onChange={(e) => setKvkNumber(e.target.value)}
						placeholder="00000000"
					/>
				</Field>
			</FieldGroup>
			<Button type="submit" disabled={saving}>
				{saving ? "Saving…" : "Save workspace"}
			</Button>
		</form>
	)
}

function AppearanceForm({ settings }: { settings: Settings }) {
	const update = useMutation(api.userSettings.update);
	const { theme, toggleTheme } = useTheme();
	const [brandColor, setBrandColor] = useState(settings?.brandColor ?? "");
	const [storedTheme, setStoredTheme] = useState<"light" | "dark" | "system">(
		settings?.theme ?? "system",
	)

	useEffect(() => {
		if (settings?.theme && settings.theme !== "system" && settings.theme !== theme) {
			// keep client theme in sync with persisted setting
			toggleTheme();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings?.theme]);

	return (
		<div className="space-y-6">
			<FieldGroup>
				<Field>
					<FieldLabel>Theme</FieldLabel>
					<div className="flex gap-2">
						{(["light", "dark", "system"] as const).map((t) => (
							<Button
								key={t}
								type="button"
								variant={storedTheme === t ? "default" : "outline"}
								onClick={async () => {
									setStoredTheme(t)
									try {
										await update({ theme: t })
										if (t !== "system" && t !== theme) toggleTheme();
									} catch (err) {
										toast.error("Could not save", {
											description:
												err instanceof Error ? err.message : String(err),
										})
									}
								}}
							>
								{t[0].toUpperCase() + t.slice(1)}
							</Button>
						))}
					</div>
				</Field>
				<Field>
					<FieldLabel htmlFor="brand-color">Brand accent (hex)</FieldLabel>
					<div className="flex gap-2">
						<Input
							id="brand-color"
							value={brandColor}
							onChange={(e) => setBrandColor(e.target.value)}
							placeholder="#1570ef"
							className="flex-1"
						/>
						<Button
							type="button"
							onClick={async () => {
								try {
									await update({
										brandColor: brandColor.trim() || undefined,
									})
									toast.success("Saved")
								} catch (err) {
									toast.error("Could not save", {
										description:
											err instanceof Error ? err.message : String(err),
									})
								}
							}}
						>
							Save
						</Button>
					</div>
				</Field>
			</FieldGroup>
		</div>
	)
}

function BillingForm({ settings }: { settings: Settings }) {
	const update = useMutation(api.userSettings.update);
	const [invoicePrefix, setInvoicePrefix] = useState(
		settings?.invoicePrefix ?? "BO-",
	)
	const [defaultCurrency, setDefaultCurrency] = useState(
		settings?.defaultCurrency ?? "EUR",
	)
	const [defaultVatRate, setDefaultVatRate] = useState(
		String(settings?.defaultVatRate ?? 21),
	)
	const [saving, setSaving] = useState(false);

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				const rate = Number(defaultVatRate);
				if (Number.isNaN(rate)) {
					toast.error("VAT rate must be a number");
					return
				}
				setSaving(true);
				try {
					await update({
						invoicePrefix: invoicePrefix.trim() || "BO-",
						defaultCurrency: defaultCurrency.trim().toUpperCase() || "EUR",
						defaultVatRate: rate,
					})
					toast.success("Saved");
				} catch (err) {
					toast.error("Could not save", {
						description: err instanceof Error ? err.message : String(err),
					})
				} finally {
					setSaving(false);
				}
			}}
			className="space-y-6"
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="invoice-prefix">Invoice number prefix</FieldLabel>
					<Input
						id="invoice-prefix"
						value={invoicePrefix}
						onChange={(e) => setInvoicePrefix(e.target.value)}
						placeholder="BO-2026-"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="currency">Default currency</FieldLabel>
					<Input
						id="currency"
						value={defaultCurrency}
						onChange={(e) => setDefaultCurrency(e.target.value)}
						placeholder="EUR"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="vat-rate">Default VAT rate (%)</FieldLabel>
					<Input
						id="vat-rate"
						type="number"
						value={defaultVatRate}
						onChange={(e) => setDefaultVatRate(e.target.value)}
						placeholder="21"
					/>
				</Field>
			</FieldGroup>
			<Button type="submit" disabled={saving}>
				{saving ? "Saving…" : "Save billing defaults"}
			</Button>
		</form>
	)
}
