import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useId, useRef, useState } from "react";
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
						<TabsTrigger value="signature">Signature</TabsTrigger>
						<TabsTrigger value="appearance">Appearance</TabsTrigger>
						<TabsTrigger value="billing">Billing defaults</TabsTrigger>
					</TabsList>
					<TabsContent value="workspace" className="pt-6">
						<WorkspaceForm settings={settings} />
					</TabsContent>
					<TabsContent value="signature" className="pt-6">
						<SignatureForm settings={settings} />
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
	);
}

type Settings = ReturnType<typeof useQuery<typeof api.userSettings.get>>;

function WorkspaceForm({ settings }: { settings: Settings }) {
	const update = useMutation(api.userSettings.update);
	const [businessName, setBusinessName] = useState(
		settings?.businessName ?? "",
	);
	const [businessAddress, setBusinessAddress] = useState(
		settings?.businessAddress ?? "",
	);
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
					});
					toast.success("Saved");
				} catch (err) {
					toast.error("Could not save", {
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
	);
}

// Downscale an uploaded image to a small PNG data URI (keeps transparency),
// so a signature stays well under Convex's document size limit.
function fileToSignatureDataUrl(file: File, maxWidth = 320): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Could not read file"));
		reader.onload = () => {
			const img = new Image();
			img.onerror = () => reject(new Error("Could not decode image"));
			img.onload = () => {
				const scale = Math.min(1, maxWidth / img.width);
				const w = Math.max(1, Math.round(img.width * scale));
				const h = Math.max(1, Math.round(img.height * scale));
				const canvas = document.createElement("canvas");
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					reject(new Error("Canvas not supported"));
					return;
				}
				ctx.drawImage(img, 0, 0, w, h);
				resolve(canvas.toDataURL("image/png"));
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
	});
}

function SignatureForm({ settings }: { settings: Settings }) {
	const update = useMutation(api.userSettings.update);
	const fileInputId = useId();
	const nameInputId = useId();
	const [name, setName] = useState(
		settings?.signatureName ?? settings?.businessName ?? "",
	);
	const [dataUrl, setDataUrl] = useState<string | undefined>(
		settings?.signatureDataUrl ?? undefined,
	);
	const [saving, setSaving] = useState(false);

	return (
		<div className="space-y-6">
			<p className="text-sm text-muted-foreground">
				Upload your handwritten signature. It's automatically placed on every
				NDA you create where <strong>you</strong> sign (i.e. you promise to keep
				the client's data confidential). A PNG with a transparent background
				looks best.
			</p>

			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={nameInputId}>Name under signature</FieldLabel>
					<Input
						id={nameInputId}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={settings?.businessName ?? "BRANDOCEAN"}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor={fileInputId}>Signature image</FieldLabel>
					<Input
						id={fileInputId}
						type="file"
						accept="image/png,image/jpeg,image/webp"
						onChange={async (e) => {
							const file = e.target.files?.[0];
							if (!file) return;
							try {
								const url = await fileToSignatureDataUrl(file);
								setDataUrl(url);
								toast.success("Signature loaded — don't forget to save");
							} catch (err) {
								toast.error("Could not load image", {
									description: err instanceof Error ? err.message : String(err),
								});
							}
						}}
					/>
				</Field>
			</FieldGroup>

			{dataUrl ? (
				<div className="space-y-2">
					<span className="text-sm font-medium">Preview</span>
					<div className="flex max-w-sm items-center justify-center rounded-lg border bg-white p-4">
						<img
							src={dataUrl}
							alt="Signature preview"
							className="max-h-24 w-auto"
						/>
					</div>
				</div>
			) : null}

			<div className="flex gap-2">
				<Button
					type="button"
					disabled={saving || !dataUrl}
					onClick={async () => {
						setSaving(true);
						try {
							await update({
								signatureDataUrl: dataUrl,
								signatureName: name.trim() || undefined,
							});
							toast.success("Signature saved");
						} catch (err) {
							toast.error("Could not save", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setSaving(false);
						}
					}}
				>
					{saving ? "Saving…" : "Save signature"}
				</Button>
				{settings?.signatureDataUrl ? (
					<Button
						type="button"
						variant="outline"
						disabled={saving}
						onClick={async () => {
							setSaving(true);
							try {
								await update({ signatureDataUrl: "" });
								setDataUrl(undefined);
								toast.success("Signature removed");
							} catch (err) {
								toast.error("Could not remove", {
									description: err instanceof Error ? err.message : String(err),
								});
							} finally {
								setSaving(false);
							}
						}}
					>
						Remove
					</Button>
				) : null}
			</div>
		</div>
	);
}

function AppearanceForm({ settings }: { settings: Settings }) {
	const update = useMutation(api.userSettings.update);
	const { preference, setTheme } = useTheme();
	const [brandColor, setBrandColor] = useState(settings?.brandColor ?? "");

	// Adopt the persisted preference once (e.g. it was changed on another
	// device). No animation — this is a silent sync, not a user toggle.
	const synced = useRef(false);
	useEffect(() => {
		if (synced.current) return;
		synced.current = true;
		if (settings?.theme && settings.theme !== preference) {
			setTheme(settings.theme, { animate: false });
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
								variant={preference === t ? "default" : "outline"}
								onClick={async () => {
									// Apply locally first so the UI never depends on the
									// round-trip; then persist. No reconciliation toggle.
									setTheme(t);
									try {
										await update({ theme: t });
									} catch (err) {
										toast.error("Could not save", {
											description:
												err instanceof Error ? err.message : String(err),
										});
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
									});
									toast.success("Saved");
								} catch (err) {
									toast.error("Could not save", {
										description:
											err instanceof Error ? err.message : String(err),
									});
								}
							}}
						>
							Save
						</Button>
					</div>
				</Field>
			</FieldGroup>
		</div>
	);
}

function BillingForm({ settings }: { settings: Settings }) {
	const update = useMutation(api.userSettings.update);
	const [invoicePrefix, setInvoicePrefix] = useState(
		settings?.invoicePrefix ?? "BO-",
	);
	const [defaultCurrency, setDefaultCurrency] = useState(
		settings?.defaultCurrency ?? "EUR",
	);
	const [defaultVatRate, setDefaultVatRate] = useState(
		String(settings?.defaultVatRate ?? 21),
	);
	const [saving, setSaving] = useState(false);

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				const rate = Number(defaultVatRate);
				if (Number.isNaN(rate)) {
					toast.error("VAT rate must be a number");
					return;
				}
				setSaving(true);
				try {
					await update({
						invoicePrefix: invoicePrefix.trim() || "BO-",
						defaultCurrency: defaultCurrency.trim().toUpperCase() || "EUR",
						defaultVatRate: rate,
					});
					toast.success("Saved");
				} catch (err) {
					toast.error("Could not save", {
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
					<FieldLabel htmlFor="invoice-prefix">
						Invoice number prefix
					</FieldLabel>
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
	);
}
