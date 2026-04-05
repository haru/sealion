import nodemailer from "nodemailer";
export { SMTP_DUMMY_PASSWORD } from "@/lib/email/smtp-constants";

/** Configuration required to send an email via SMTP. */
export interface SendMailConfig {
  /** SMTP server hostname. */
  host: string;
  /** SMTP server port (e.g. 587 for STARTTLS, 465 for TLS). */
  port: number;
  /** Sender email address used in the `From` header. */
  fromAddress: string;
  /** Sender display name used in the `From` header. */
  fromName: string;
  /** Whether SMTP authentication is required. */
  requireAuth: boolean;
  /** SMTP auth username; used only when `requireAuth` is `true`. */
  username: string | null;
  /** Plaintext SMTP auth password; used only when `requireAuth` is `true` and not `null`. */
  password: string | null;
  /** Whether to use implicit TLS (`true` = port 465 style). */
  useTls: boolean;
  /** Recipient email address. */
  to: string;
  /** Email subject line. */
  subject: string;
  /** Plaintext email body. */
  text: string;
}

/**
 * Sends a single email via SMTP using nodemailer.
 *
 * Creates a one-shot transport per invocation. Throws if the transport
 * encounters a connection, authentication, or delivery error.
 *
 * @param config - SMTP connection details and message content.
 * @returns A promise that resolves when the message is accepted by the server.
 * @throws If nodemailer reports a connection, auth, or delivery error.
 */
export async function sendMail(config: SendMailConfig): Promise<void> {
  const { host, port, fromAddress, fromName, requireAuth, username, password, useTls, to, subject, text } = config;

  const smtpUsername = username?.trim() ?? "";
  const smtpPassword = password?.trim() ?? "";

  if (requireAuth && (!smtpUsername || !smtpPassword)) {
    throw new Error("SMTP authentication requires both a username and password.");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: useTls,
    auth: requireAuth ? { user: smtpUsername, pass: smtpPassword } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text,
  });
}
