/** @jest-environment node */
/**
 * Unit tests for getSmtpSettings in src/lib/smtp-settings.ts.
 */

jest.mock("@/lib/db", () => ({
  prisma: {
    smtpSettings: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockFindUnique = prisma.smtpSettings.findUnique as jest.Mock;

const SINGLETON = {
  id: "singleton",
  host: "smtp.example.com",
  port: 587,
  fromAddress: "noreply@example.com",
  fromName: "Sealion",
  requireAuth: false,
  username: null,
  encryptedPassword: null,
  useTls: false,
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getSmtpSettings", () => {
  it("returns null when no record exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const { getSmtpSettings } = await import("@/lib/smtp-settings");
    const result = await getSmtpSettings();

    expect(result).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "singleton" } });
  });

  it("returns record with encryptedPassword when present", async () => {
    const recordWithPassword = { ...SINGLETON, encryptedPassword: "encrypted:abc:def" };
    mockFindUnique.mockResolvedValue(recordWithPassword);

    const { getSmtpSettings } = await import("@/lib/smtp-settings");
    const result = await getSmtpSettings();

    expect(result).not.toBeNull();
    expect(result).toEqual(recordWithPassword);
    expect(result?.encryptedPassword).toBe("encrypted:abc:def");
  });

  it("returns record without password set when no encryptedPassword", async () => {
    mockFindUnique.mockResolvedValue(SINGLETON);

    const { getSmtpSettings } = await import("@/lib/smtp-settings");
    const result = await getSmtpSettings();

    expect(result).toEqual(SINGLETON);
    expect(result?.encryptedPassword).toBeNull();
  });
});
