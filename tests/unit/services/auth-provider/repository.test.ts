/** @jest-environment node */
/**
 * Unit tests for the auth-provider repository.
 * Verifies the encryption round-trip, the enabled-only filter, and
 * the linked-account counter. Prisma is mocked.
 */

jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
}));

jest.mock("@/lib/db/db", () => ({
  prisma: {
    authProvider: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    account: {
      count: jest.fn(),
    },
  },
}));

import { AuthProviderType } from "@prisma/client";

import { prisma } from "@/lib/db/db";
import { decrypt, encrypt } from "@/lib/encryption/encryption";
import {
  countLinkedAccounts,
  create,
  findById,
  findByProviderId,
  listAll,
  listEnabled,
  remove,
  update,
} from "@/services/auth-provider/repository";

const TEST_KEY = "0".repeat(63) + "1";
process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;

const mockFindMany = prisma.authProvider.findMany as jest.Mock;
const mockFindUnique = prisma.authProvider.findUnique as jest.Mock;
const mockCreate = prisma.authProvider.create as jest.Mock;
const mockUpdate = prisma.authProvider.update as jest.Mock;
const mockDelete = prisma.authProvider.delete as jest.Mock;
const mockAccountCount = prisma.account.count as jest.Mock;

const NOW = new Date("2026-05-17T00:00:00Z");

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec_1",
    providerId: "google",
    type: AuthProviderType.GOOGLE,
    displayName: "Google",
    enabled: true,
    issuerUrl: null,
    clientId: "client-id-value",
    encryptedClientSecret: encrypt("plain-secret"),
    scope: null,
    createdAt: NOW,
    updatedAt: NOW,
    createdById: null,
    updatedById: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("repository.listAll", () => {
  it("decrypts every row and orders by createdAt asc", async () => {
    mockFindMany.mockResolvedValue([makeRow(), makeRow({ id: "rec_2", providerId: "github" })]);
    const rows = await listAll();
    expect(rows).toHaveLength(2);
    expect(rows[0].clientSecret).toBe("plain-secret");
    expect(rows[1].clientSecret).toBe("plain-secret");
    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
  });
});

describe("repository.listEnabled", () => {
  it("queries only enabled rows", async () => {
    mockFindMany.mockResolvedValue([makeRow()]);
    const rows = await listEnabled();
    expect(rows).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("repository.findById / findByProviderId", () => {
  it("findById returns null when missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await findById("missing");
    expect(result).toBeNull();
  });

  it("findById decrypts on hit", async () => {
    mockFindUnique.mockResolvedValue(makeRow());
    const result = await findById("rec_1");
    expect(result?.clientSecret).toBe("plain-secret");
  });

  it("findByProviderId uses providerId in where", async () => {
    mockFindUnique.mockResolvedValue(null);
    await findByProviderId("google");
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { providerId: "google" } });
  });
});

describe("repository.create", () => {
  it("encrypts the client secret before writing", async () => {
    mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeRow({ ...data })),
    );

    await create(
      {
        providerId: "google",
        type: AuthProviderType.GOOGLE,
        displayName: "Google",
        enabled: true,
        clientId: "cid",
        clientSecret: "shhh",
      },
      "admin_1",
    );

    const arg = mockCreate.mock.calls[0]![0] as { data: { encryptedClientSecret: string } };
    expect(arg.data.encryptedClientSecret).not.toBe("shhh");
    expect(decrypt(arg.data.encryptedClientSecret)).toBe("shhh");
  });

  it("nulls issuerUrl for GOOGLE / GITHUB types", async () => {
    mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeRow({ ...data })),
    );

    await create({
      providerId: "github",
      type: AuthProviderType.GITHUB,
      displayName: "GitHub",
      enabled: true,
      issuerUrl: "https://should-be-ignored.example.com",
      clientId: "cid",
      clientSecret: "s",
    });

    const arg = mockCreate.mock.calls[0]![0] as { data: { issuerUrl: string | null } };
    expect(arg.data.issuerUrl).toBeNull();
  });

  it("keeps issuerUrl for OIDC_GENERIC", async () => {
    mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeRow({ ...data })),
    );

    await create({
      providerId: "kc",
      type: AuthProviderType.OIDC_GENERIC,
      displayName: "KC",
      enabled: true,
      issuerUrl: "https://kc.example.com",
      clientId: "cid",
      clientSecret: "s",
    });

    const arg = mockCreate.mock.calls[0]![0] as { data: { issuerUrl: string | null } };
    expect(arg.data.issuerUrl).toBe("https://kc.example.com");
  });
});

describe("repository.update", () => {
  it("re-encrypts when clientSecret is provided", async () => {
    mockUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeRow({ ...data })),
    );

    await update("rec_1", { clientSecret: "new-secret" });

    const arg = mockUpdate.mock.calls[0]![0] as {
      data: { encryptedClientSecret?: string };
    };
    expect(arg.data.encryptedClientSecret).toBeDefined();
    expect(decrypt(arg.data.encryptedClientSecret!)).toBe("new-secret");
  });

  it("omits encryptedClientSecret when clientSecret is undefined", async () => {
    mockUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeRow({ ...data })),
    );

    await update("rec_1", { displayName: "Renamed" });

    const arg = mockUpdate.mock.calls[0]![0] as {
      data: { encryptedClientSecret?: string; displayName?: string };
    };
    expect(arg.data.encryptedClientSecret).toBeUndefined();
    expect(arg.data.displayName).toBe("Renamed");
  });
});

describe("repository.remove", () => {
  it("calls prisma.authProvider.delete with the id", async () => {
    mockDelete.mockResolvedValue(makeRow());
    await remove("rec_1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "rec_1" } });
  });
});

describe("repository.countLinkedAccounts", () => {
  it("returns 0 when no accounts reference the providerId", async () => {
    mockAccountCount.mockResolvedValue(0);
    expect(await countLinkedAccounts("google")).toBe(0);
    expect(mockAccountCount).toHaveBeenCalledWith({ where: { provider: "google" } });
  });

  it("returns the non-zero count when accounts exist", async () => {
    mockAccountCount.mockResolvedValue(42);
    expect(await countLinkedAccounts("google")).toBe(42);
  });
});
