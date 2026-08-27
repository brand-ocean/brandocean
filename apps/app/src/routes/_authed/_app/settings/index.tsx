import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { CountTabs } from "@/components/app/toolbar";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/context/ThemeContext";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_authed/_app/settings/")({
	component: SettingsPage,
});

const SETTINGS_TABS = [
	{ id: "workspace", label: "Workspace" },
	{ id: "signature", label: "Signature" },
	{ id: "appearance", label: "Appearance" },
	{ id: "billing", label: "Billing defaults" },
] as const;

const TAB_BLURB: Record<string, string> = {
	workspace: "The business details printed on offertes, NDAs and invoices.",
	signature: "Your handwritten signature, auto-applied to NDAs you sign.",
	appearance: "How the app looks on this device.",
	billing: "Defaults applied to every new invoice.",
};

function SettingsPage() {
	const settings = useQuery(api.userSettings.get);
	const [tab, setTab] = useState<string>("workspace");

	return (
		<Frame className="mx-auto w-full max-w-4xl">
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Settings</FrameTitle>
					<FrameDescription>{TAB_BLURB[tab]}</FrameDescription>
				</FrameHeading>
			</FrameHeader>
			<CountTabs
				value={tab}
				onValueChange={setTab}
				tabs={SETTINGS_TABS.map((t) => ({ id: t.id, label: t.label }))}
			/>
			<FramePanel>
				{settings === undefined ? (
					<Skeleton className="h-64" />
				) : tab === "workspace" ? (
					<WorkspaceForm settings={settings} />
				) : tab === "signature" ? (
					<SignatureForm settings={settings} />
				) : tab === "appearance" ? (
					<AppearanceForm settings={settings} />
				) : (
					<BillingForm settings={settings} />
				)}
			</FramePanel>
		</Frame>
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
	const [businessStreet, setBusinessStreet] = useState(
		settings?.businessStreet ?? "",
	);
	const [businessPostalCode, setBusinessPostalCode] = useState(
		settings?.businessPostalCode ?? "",
	);
	const [businessCity, setBusinessCity] = useState(
		settings?.businessCity ?? "",
	);
	const [businessCountryCode, setBusinessCountryCode] = useState(
		settings?.businessCountryCode ?? "",
	);
	const [businessEmail, setBusinessEmail] = useState(
		settings?.businessEmail ?? "",
	);
	const [iban, setIban] = useState(settings?.iban ?? "");
	const [bic, setBic] = useState(settings?.bic ?? "");
	const [vatNumber, setVatNumber] = useState(settings?.vatNumber ?? "");
	const [kvkNumber, setKvkNumber] = useState(settings?.kvkNumber ?? "");
	const [saving, setSaving] = useState(false);
	const streetId = useId();
	const postalCodeId = useId();
	const cityId = useId();
	const countryId = useId();
	const emailId = useId();
	const ibanId = useId();
	const bicId = useId();

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				setSaving(true);
				try {
					await update({
						businessName: businessName.trim() || undefined,
						businessAddress: businessAddress.trim() || undefined,
						businessStreet: businessStreet.trim() || undefined,
						businessPostalCode: businessPostalCode.trim() || undefined,
						businessCity: businessCity.trim() || undefined,
						businessCountryCode:
							businessCountryCode.trim().toUpperCase() || undefined,
						businessEmail: businessEmail.trim() || undefined,
						iban: iban.replace(/\s+/g, "").toUpperCase() || undefined,
						bic: bic.trim().toUpperCase() || undefined,
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
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<Field>
						<FieldLabel htmlFor={streetId}>Straat + nummer</FieldLabel>
						<Input
							id={streetId}
							value={businessStreet}
							onChange={(e) => setBusinessStreet(e.target.value)}
							placeholder="Rooswijck 5A"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={postalCodeId}>Postcode</FieldLabel>
						<Input
							id={postalCodeId}
							value={businessPostalCode}
							onChange={(e) => setBusinessPostalCode(e.target.value)}
							placeholder="1081AJ"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={cityId}>Plaats</FieldLabel>
						<Input
							id={cityId}
							value={businessCity}
							onChange={(e) => setBusinessCity(e.target.value)}
							placeholder="Amsterdam"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={countryId}>Landcode (ISO, bv. NL)</FieldLabel>
						<Input
							id={countryId}
							value={businessCountryCode}
							onChange={(e) => setBusinessCountryCode(e.target.value)}
							placeholder="NL"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={emailId}>Zakelijke e-mail</FieldLabel>
						<Input
							id={emailId}
							type="email"
							value={businessEmail}
							onChange={(e) => setBusinessEmail(e.target.value)}
							placeholder="info@brandocean.nl"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={ibanId}>IBAN</FieldLabel>
						<Input
							id={ibanId}
							value={iban}
							onChange={(e) => setIban(e.target.value)}
							placeholder="NL43INGB0109900731"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={bicId}>BIC</FieldLabel>
						<Input
							id={bicId}
							value={bic}
							onChange={(e) => setBic(e.target.value)}
							placeholder="INGBNL2A"
						/>
					</Field>
				</div>
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
