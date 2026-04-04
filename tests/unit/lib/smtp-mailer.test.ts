/** @jest-environment node */
/**
 * Unit tests for smtp-mailer.ts — SMTP_DUMMY_PASSWORD constant and sendMail function.
 */

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock("nodemailer", () => ({
  createTransport: mockCreateTransport,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SMTP_DUMMY_PASSWORD", () => {
  it("has the expected sentinel value", async () => {
    const { SMTP_DUMMY_PASSWORD } = await import("@/lib/smtp-mailer");
    expect(SMTP_DUMMY_PASSWORD).toBe("__SEALION_DUMMY_SMTP_PASSWORD__");
  });
});

describe("sendMail", () => {
  const baseConfig = {
    host: "smtp.example.com",
    port: 587,
    fromAddress: "noreply@example.com",
    fromName: "Sealion",
    requireAuth: false,
    username: null,
    password: null,
    useTls: false,
    to: "recipient@example.com",
    subject: "Test",
    text: "Hello",
  };

  it("calls createTransport with secure:false when useTls is false", async () => {
    mockSendMail.mockResolvedValue({ messageId: "1" });

    const { sendMail } = await import("@/lib/smtp-mailer");
    await sendMail(baseConfig);

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.com", port: 587, secure: false })
    );
  });

  it("calls createTransport with secure:true when useTls is true", async () => {
    mockSendMail.mockResolvedValue({ messageId: "1" });

    const { sendMail } = await import("@/lib/smtp-mailer");
    await sendMail({ ...baseConfig, useTls: true });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true })
    );
  });

  it("calls createTransport without auth when requireAuth is false", async () => {
    mockSendMail.mockResolvedValue({ messageId: "1" });

    const { sendMail } = await import("@/lib/smtp-mailer");
    await sendMail(baseConfig);

    const transportOptions = mockCreateTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(transportOptions.auth).toBeUndefined();
  });

  it("calls createTransport with auth when requireAuth is true", async () => {
    mockSendMail.mockResolvedValue({ messageId: "1" });

    const { sendMail } = await import("@/lib/smtp-mailer");
    await sendMail({ ...baseConfig, requireAuth: true, username: "user@example.com", password: "secret" });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: "user@example.com", pass: "secret" },
      })
    );
  });

  it("throws when requireAuth is true but password is null", async () => {
    const { sendMail } = await import("@/lib/smtp-mailer");

    await expect(
      sendMail({ ...baseConfig, requireAuth: true, username: "user@example.com", password: null })
    ).rejects.toThrow("SMTP authentication requires both a username and password.");
  });

  it("throws when requireAuth is true but username is null", async () => {
    const { sendMail } = await import("@/lib/smtp-mailer");

    await expect(
      sendMail({ ...baseConfig, requireAuth: true, username: null, password: "secret" })
    ).rejects.toThrow("SMTP authentication requires both a username and password.");
  });

  it("throws when requireAuth is true but username is empty", async () => {
    const { sendMail } = await import("@/lib/smtp-mailer");

    await expect(
      sendMail({ ...baseConfig, requireAuth: true, username: "  ", password: "secret" })
    ).rejects.toThrow("SMTP authentication requires both a username and password.");
  });

  it("sets connection, greeting, and socket timeouts on transport", async () => {
    mockSendMail.mockResolvedValue({ messageId: "1" });

    const { sendMail } = await import("@/lib/smtp-mailer");
    await sendMail(baseConfig);

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      })
    );
  });

  it("calls sendMail with correct from/to/subject/text", async () => {
    mockSendMail.mockResolvedValue({ messageId: "1" });

    const { sendMail } = await import("@/lib/smtp-mailer");
    await sendMail(baseConfig);

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Sealion" <noreply@example.com>',
        to: "recipient@example.com",
        subject: "Test",
        text: "Hello",
      })
    );
  });

  it("throws when the transport sendMail rejects", async () => {
    mockSendMail.mockRejectedValue(new Error("Connection refused"));

    const { sendMail } = await import("@/lib/smtp-mailer");

    await expect(sendMail(baseConfig)).rejects.toThrow("Connection refused");
  });
});
