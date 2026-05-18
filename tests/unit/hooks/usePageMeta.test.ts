import { renderHook, act } from "@testing-library/react";
import React from "react";

import { PageHeaderContext, PageHeaderProvider } from "@/contexts/PageHeaderContext";

const { usePageMeta } = jest.requireActual("@/hooks/usePageMeta") as typeof import("@/hooks/usePageMeta");

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/projects"),
}));

jest.mock("next-intl", () => ({
  useTranslations: jest.fn((namespace: string) => {
    const translations: Record<string, Record<string, string>> = {
      projects: { title: "Projects" },
      sidebar: { systemAdmin: "System Settings" },
      todo: { title: "My TODO List" },
      boardSettings: { title: "Board Settings" },
      providers: { title: "Issue Trackers" },
      profileSettings: { title: "Profile Settings" },
      admin: { userManagement: "Users" },
      authSettings: { title: "Auth Settings" },
      smtpSettings: { title: "Email Settings" },
      "authProviders.admin": { title: "Authentication Providers" },
      common: { table: { noRows: "No data" } },
    };
    return (key: string) => translations[namespace]?.[key] ?? `[${namespace}.${key}]`;
  }),
}));

function createWrapper(overrides: Record<string, unknown> = {}) {
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    const contextValue: Record<string, unknown> = {
      title: "",
      actions: null,
      icon: null,
      titleAddon: null,
      breadcrumbParent: null,
      breadcrumbParentIcon: null,
      setPageHeader: jest.fn(),
      ...overrides,
    };
    return React.createElement(
      PageHeaderContext.Provider,
      { value: contextValue },
      children,
    );
  };
}

describe("usePageMeta", () => {
  it("calls setPageHeader with title from route config", () => {
    const mockSetPageHeader = jest.fn();
    const wrapper = createWrapper({ setPageHeader: mockSetPageHeader });

    renderHook(() => usePageMeta(), { wrapper });

    const calls = mockSetPageHeader.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toBe("Projects");
  });

  it("calls setPageHeader with an icon component", () => {
    const mockSetPageHeader = jest.fn();
    const wrapper = createWrapper({ setPageHeader: mockSetPageHeader });

    renderHook(() => usePageMeta(), { wrapper });

    const calls = mockSetPageHeader.mock.calls;
    expect(calls[0][2]).toBeDefined();
  });

  it("does not set breadcrumbParent for non-admin routes", () => {
    const mockSetPageHeader = jest.fn();
    const wrapper = createWrapper({ setPageHeader: mockSetPageHeader });

    renderHook(() => usePageMeta(), { wrapper });

    const calls = mockSetPageHeader.mock.calls;
    expect(calls[0][4]).toBeUndefined();
  });

  it("sets breadcrumbParent for admin routes", () => {
    jest.requireMock("next/navigation").usePathname.mockReturnValue("/admin/users");
    const mockSetPageHeader = jest.fn();
    const wrapper = createWrapper({ setPageHeader: mockSetPageHeader });

    renderHook(() => usePageMeta(), { wrapper });

    const calls = mockSetPageHeader.mock.calls;
    expect(calls[0][4]).toBe("System Settings");
  });

  it("passes actions to setPageHeader when provided", () => {
    jest.requireMock("next/navigation").usePathname.mockReturnValue("/projects");
    const mockSetPageHeader = jest.fn();
    const actions = React.createElement("button", null, "Test");
    const wrapper = createWrapper({ setPageHeader: mockSetPageHeader });

    renderHook(() => usePageMeta(actions), { wrapper });

    const calls = mockSetPageHeader.mock.calls;
    expect(calls[0][1]).toBe(actions);
  });

  it("passes titleAddon to setPageHeader when provided", () => {
    jest.requireMock("next/navigation").usePathname.mockReturnValue("/projects");
    const mockSetPageHeader = jest.fn();
    const addon = React.createElement("span", null, "badge");
    const wrapper = createWrapper({ setPageHeader: mockSetPageHeader });

    renderHook(() => usePageMeta(undefined, addon), { wrapper });

    const calls = mockSetPageHeader.mock.calls;
    expect(calls[0][3]).toBe(addon);
  });

  it("clears header on unmount", () => {
    jest.requireMock("next/navigation").usePathname.mockReturnValue("/projects");
    const mockSetPageHeader = jest.fn();
    const wrapper = createWrapper({ setPageHeader: mockSetPageHeader });

    const { unmount } = renderHook(() => usePageMeta(), { wrapper });

    act(() => { unmount(); });

    const lastCall = mockSetPageHeader.mock.calls[mockSetPageHeader.mock.calls.length - 1];
    expect(lastCall[0]).toBe("");
    expect(lastCall[1]).toBeNull();
  });
});
