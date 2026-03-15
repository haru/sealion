import { encrypt, decrypt } from "@/lib/encryption";

const VALID_KEY = "a".repeat(64); // 64-char hex string for 32 bytes

describe("encryption", () => {
  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  });

  describe("encrypt / decrypt roundtrip", () => {
    it("returns the original plaintext after encrypt → decrypt", () => {
      const plaintext = "super-secret-token-12345";
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it("produces different ciphertext each call (unique IV)", () => {
      const plaintext = "same-value";
      const first = encrypt(plaintext);
      const second = encrypt(plaintext);
      expect(first).not.toBe(second);
    });

    it("ciphertext contains three base64 parts separated by colons", () => {
      const ciphertext = encrypt("hello");
      const parts = ciphertext.split(":");
      expect(parts).toHaveLength(3);
    });

    it("handles empty string", () => {
      expect(decrypt(encrypt(""))).toBe("");
    });

    it("handles unicode characters", () => {
      const plaintext = "パスワード 🔐";
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });
  });

  describe("decrypt with tampered ciphertext", () => {
    it("throws when auth tag is tampered", () => {
      const ciphertext = encrypt("secret");
      const parts = ciphertext.split(":");
      // Tamper with the auth tag (second part)
      parts[1] = Buffer.from("tampered-auth-tag").toString("base64");
      expect(() => decrypt(parts.join(":"))).toThrow();
    });

    it("throws when ciphertext data is tampered", () => {
      const ciphertext = encrypt("secret");
      const parts = ciphertext.split(":");
      // Tamper with the encrypted data (third part)
      parts[2] = Buffer.from("tampered-data").toString("base64");
      expect(() => decrypt(parts.join(":"))).toThrow();
    });

    it("throws on invalid format (missing parts)", () => {
      expect(() => decrypt("onlyonepart")).toThrow("Invalid ciphertext format");
    });

    it("throws when encryption key is missing", () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      expect(() => encrypt("test")).toThrow("CREDENTIALS_ENCRYPTION_KEY");
    });

    it("throws when encryption key is wrong length", () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = "tooshort";
      expect(() => encrypt("test")).toThrow("CREDENTIALS_ENCRYPTION_KEY");
    });
  });
});
