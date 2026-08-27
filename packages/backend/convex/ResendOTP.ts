import Resend from "@auth/core/providers/resend";
import { type RandomReader, generateRandomString } from "@oslojs/crypto/random";

const random: RandomReader = {
	read(bytes) {
		crypto.getRandomValues(bytes);
	},
};

export const ResendOTP = Resend({
	id: "resend-otp",
	apiKey: process.env.AUTH_RESEND_KEY,
	maxAge: 60 * 15,
	async generateVerificationToken() {
		return generateRandomString(random, "0123456789", 6);
	},
	async sendVerificationRequest({ identifier: email, provider, token }) {
		const from =
			process.env.AUTH_EMAIL_FROM ?? "Offertes <onboarding@resend.dev>";
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${provider.apiKey}`,
				"Content-Type": "application/json",
				"Idempotency-Key": `otp/${email}/${token}`,
			},
			body: JSON.stringify({
				from,
				to: [email],
				subject: `Your sign-in code: ${token}`,
				text: `Your sign-in code is ${token}. It expires in 15 minutes.`,
				html: `<p>Your sign-in code is <strong>${token}</strong>.</p><p>It expires in 15 minutes.</p>`,
			}),
		});
		if (!res.ok) {
			throw new Error(`Resend send failed: ${JSON.stringify(await res.json())}`);
		}
	},
});
