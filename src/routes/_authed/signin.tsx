import { useAuthActions } from "@convex-dev/auth/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authed/signin")({
	component: SignInPage,
});

function friendlyAuthError(
	err: unknown,
	context: "signIn" | "signUp" | "sendCode" | "verifyCode",
): string {
	const raw = err instanceof Error ? err.message : String(err);
	if (/InvalidSecret/i.test(raw)) return "Incorrect email or password.";
	if (/InvalidAccountId|AccountNotFound|No account/i.test(raw))
		return context === "signIn"
			? "No account found for that email."
			: "We couldn't find that account.";
	if (/AlreadyExists|account.*exists/i.test(raw))
		return "An account with that email already exists.";
	if (/Invalid.*code|expired|TokenExpired/i.test(raw))
		return "That code is invalid or expired. Request a new one.";
	if (/RateLimit|TooMany/i.test(raw))
		return "Too many attempts. Please wait a moment and try again.";
	if (/Network|Failed to fetch/i.test(raw))
		return "Network error. Check your connection and try again.";
	return "Something went wrong. Please try again.";
}

function SignInPage() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center bg-muted px-6 py-12">
			<div className="w-full max-w-md">
				<Card>
					<CardHeader className="text-center">
						<CardTitle className="text-2xl">Sign in</CardTitle>
						<CardDescription>
							Owner access to the BRANDOCEAN dashboard.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Tabs defaultValue="password" className="w-full">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="password">Password</TabsTrigger>
								<TabsTrigger value="otp">Email code</TabsTrigger>
							</TabsList>
							<TabsContent value="password">
								<PasswordForm />
							</TabsContent>
							<TabsContent value="otp">
								<OtpForm />
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
				<FieldDescription className="mt-4 text-center">
					Locked to admin emails only. New accounts must be allowlisted.
				</FieldDescription>
			</div>
		</div>
	)
}

function PasswordForm() {
	const { signIn } = useAuthActions();
	const navigate = useNavigate();
	const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
	const [submitting, setSubmitting] = useState(false);

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				const formData = new FormData(e.currentTarget);
				formData.set("flow", mode);
				setSubmitting(true);
				try {
					await signIn("password", formData);
					navigate({ to: "/offertes" });
				} catch (err) {
					toast.error(mode === "signIn" ? "Sign-in failed" : "Sign-up failed", {
						description: friendlyAuthError(err, mode),
					})
				} finally {
					setSubmitting(false);
				}
			}}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="email">Email</FieldLabel>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="info@brandocean.nl"
						autoComplete="email"
						required
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="password">Password</FieldLabel>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete={
							mode === "signIn" ? "current-password" : "new-password"
						}
						required
					/>
					{mode === "signUp" ? (
						<FieldDescription>
							Min 8 characters with uppercase, lowercase, and a digit.
						</FieldDescription>
					) : null}
				</Field>
				<Field>
					<Button type="submit" disabled={submitting}>
						{submitting
							? "…"
							: mode === "signIn"
								? "Sign in"
								: "Create account"}
					</Button>
				</Field>
				<FieldDescription className="text-center">
					{mode === "signIn" ? "No account? " : "Already have one? "}
					<button
						type="button"
						onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
						className="underline underline-offset-2 hover:no-underline"
					>
						{mode === "signIn" ? "Sign up" : "Sign in"}
					</button>
				</FieldDescription>
				<FieldSeparator>Or continue with</FieldSeparator>
				<OAuthButtons />
			</FieldGroup>
		</form>
	)
}

function OtpForm() {
	const { signIn } = useAuthActions();
	const navigate = useNavigate();
	const [step, setStep] = useState<"email" | "code">("email");
	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);

	if (step === "email") {
		return (
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					setSubmitting(true);
					try {
						await signIn("resend-otp", { email });
						setStep("code")
						toast.success("Code sent", {
							description: `Check ${email} for the 6-digit code.`,
						})
					} catch (err) {
						toast.error("Could not send code", {
							description: friendlyAuthError(err, "sendCode"),
						})
					} finally {
						setSubmitting(false);
					}
				}}
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="otp-email">Email</FieldLabel>
						<Input
							id="otp-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="info@brandocean.nl"
							autoComplete="email"
							required
						/>
					</Field>
					<Field>
						<Button type="submit" disabled={submitting}>
							{submitting ? "…" : "Send me a code"}
						</Button>
					</Field>
					<FieldSeparator>Or continue with</FieldSeparator>
					<OAuthButtons />
				</FieldGroup>
			</form>
		)
	}

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				const formData = new FormData(e.currentTarget);
				formData.set("email", email);
				setSubmitting(true);
				try {
					await signIn("resend-otp", formData);
					navigate({ to: "/offertes" });
				} catch (err) {
					toast.error("Invalid code", {
						description: friendlyAuthError(err, "verifyCode"),
					})
				} finally {
					setSubmitting(false);
				}
			}}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="otp-code">6-digit code</FieldLabel>
					<Input
						id="otp-code"
						name="code"
						type="text"
						inputMode="numeric"
						pattern="[0-9]{6}"
						maxLength={6}
						autoComplete="one-time-code"
						placeholder="000000"
						className="text-center font-mono text-lg tracking-widest"
						required
					/>
					<FieldDescription>Sent to {email}.</FieldDescription>
				</Field>
				<Field>
					<Button type="submit" disabled={submitting}>
						{submitting ? "…" : "Verify"}
					</Button>
				</Field>
				<FieldDescription className="text-center">
					<button
						type="button"
						onClick={() => setStep("email")}
						className="underline underline-offset-2 hover:no-underline"
					>
						Use a different email
					</button>
				</FieldDescription>
			</FieldGroup>
		</form>
	)
}

function OAuthButtons() {
	const { signIn } = useAuthActions();
	return (
		<Field className="grid grid-cols-2 gap-3">
			<Button
				type="button"
				variant="outline"
				onClick={() => void signIn("google")}
			>
				Google
			</Button>
			<Button
				type="button"
				variant="outline"
				onClick={() => void signIn("github")}
			>
				GitHub
			</Button>
		</Field>
	)
}
