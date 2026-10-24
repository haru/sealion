/** @jest-environment jsdom */
/**
 * Unit tests for useReauthAfterPasswordChange (spec 045, research R5).
 * After the server revokes every session on a password change, the current browser
 * signs in again with the new password so the user can keep working.
 */
import { renderHook } from "@testing-library/react";

const mockRefresh = jest.fn();
const mockSignIn = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
jest.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => mockSignIn(...args) }));

import { useReauthAfterPasswordChange } from "@/app/(dashboard)/settings/profile/useReauthAfterPasswordChange";

describe("useReauthAfterPasswordChange", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it("signs in again with the new password, without redirecting", async () => {
    mockSignIn.mockResolvedValue({ error: undefined, ok: true });
    const { result } = renderHook(() => useReauthAfterPasswordChange());

    await result.current("user@example.com", "new-password-123");

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "new-password-123",
      redirect: false,
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("logs and refreshes the router (which lands on the login page) when sign-in reports an error", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin", ok: false });
    const { result } = renderHook(() => useReauthAfterPasswordChange());

    await result.current("user@example.com", "new-password-123");

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("[profile] re-sign-in after password change failed", "CredentialsSignin");
    errorSpy.mockRestore();
  });

  it("refreshes the router when sign-in returns nothing", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockSignIn.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReauthAfterPasswordChange());

    await result.current("user@example.com", "new-password-123");

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("logs and refreshes the router when sign-in throws (e.g. network failure)", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockSignIn.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useReauthAfterPasswordChange());

    await expect(result.current("user@example.com", "new-password-123")).resolves.toBeUndefined();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[profile] re-sign-in after password change failed",
      expect.objectContaining({ message: "network" }),
    );
    errorSpy.mockRestore();
  });
});
