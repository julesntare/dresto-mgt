import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resend) {
    // No RESEND_API_KEY configured — log so the flow is still testable in dev.
    console.log(`[email] RESEND_API_KEY not set. Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: fromEmail,
    to,
    subject: "Reset your D'Resto password",
    html: `
      <p>Someone requested a password reset for your D'Resto account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 30 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
