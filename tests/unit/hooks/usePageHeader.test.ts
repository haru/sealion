/**
 * Unit tests for the usePageHeader hook.
 */

import { renderHook, act } from "@testing-library/react";
import React from "react";
import { usePageHeader } from "@/hooks/usePageHeader";
import { PageHeaderContext, PageHeaderProvider } from "@/contexts/PageHeaderContext";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(PageHeaderProvider, null, children);

describe("usePageHeader", () => {

  it("sets title in the context when mounted", () => {
    const { result } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Overview");
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.title).toBe("Overview");
  });

  it("sets title and actions in the context when mounted with actions", () => {
    const actions = React.createElement("button", null, "Add");

    const { result } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Projects", actions);
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.title).toBe("Projects");
    expect(result.current.actions).toBe(actions);
  });

  it("clears title on unmount", () => {
    const mockSetPageHeader = jest.fn();
    const mockWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        PageHeaderContext.Provider,
        {
          value: {
            title: "",
            actions: null,
            icon: null,
            titleAddon: null,
            breadcrumbParent: null,
            breadcrumbParentIcon: null,
            setPageHeader: mockSetPageHeader,
          },
        },
        children
      );

    const { unmount } = renderHook(() => usePageHeader("Temp"), {
      wrapper: mockWrapper,
    });

    // On mount, setPageHeader should have been called with the title
    expect(mockSetPageHeader).toHaveBeenCalledWith("Temp", undefined, undefined, undefined, undefined, undefined);

    act(() => {
      unmount();
    });

    // On unmount, the cleanup should call setPageHeader("", null)
    expect(mockSetPageHeader).toHaveBeenLastCalledWith("", null);
  });

  it("updates title when the title argument changes", () => {
    let title = "Initial";

    const { result, rerender } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader(title);
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.title).toBe("Initial");

    title = "Updated";
    rerender();

    expect(result.current.title).toBe("Updated");
  });

  it("sets icon in the context when mounted with an icon component", () => {
    // Defined outside the renderHook callback to keep a stable reference across re-renders.
    function StableIcon() { return null; }

    const { result } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Dashboard", undefined, StableIcon);
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.title).toBe("Dashboard");
    expect(result.current.icon).toBe(StableIcon);
  });

  it("sets icon to null in context when no icon is provided", () => {
    const { result } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Settings");
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.icon).toBeNull();
  });

  it("passes icon to setPageHeader on mount and clears on unmount", () => {
    // Defined outside the renderHook callback to keep a stable reference across re-renders.
    function StableMockIcon() { return null; }
    const mockSetPageHeader = jest.fn();
    const mockWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        PageHeaderContext.Provider,
        {
          value: {
            title: "",
            actions: null,
            icon: null,
            titleAddon: null,
            breadcrumbParent: null,
            breadcrumbParentIcon: null,
            setPageHeader: mockSetPageHeader,
          },
        },
        children
      );

    const { unmount } = renderHook(
      () => usePageHeader("Providers", undefined, StableMockIcon),
      { wrapper: mockWrapper }
    );

    expect(mockSetPageHeader).toHaveBeenCalledWith("Providers", undefined, StableMockIcon, undefined, undefined, undefined);

    act(() => {
      unmount();
    });

    expect(mockSetPageHeader).toHaveBeenLastCalledWith("", null);
  });

  it("updates icon in context when icon argument changes", () => {
    const IconA = () => null;
    const IconB = () => null;
    let icon: React.ElementType | undefined = IconA;

    const { result, rerender } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Page", undefined, icon);
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.icon).toBe(IconA);

    icon = IconB;
    rerender();

    expect(result.current.icon).toBe(IconB);
  });

  it("sets titleAddon in context when mounted with a titleAddon node", () => {
    const badge = React.createElement("span", { "data-testid": "sync-chip" }, "synced");

    const { result } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Dashboard", undefined, undefined, badge);
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.titleAddon).toBe(badge);
  });

  it("passes titleAddon to setPageHeader on mount", () => {
    const mockSetPageHeader = jest.fn();
    const badge = React.createElement("span", null, "synced");
    const mockWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        PageHeaderContext.Provider,
        {
          value: {
            title: "",
            actions: null,
            icon: null,
            titleAddon: null,
            breadcrumbParent: null,
            breadcrumbParentIcon: null,
            setPageHeader: mockSetPageHeader,
          },
        },
        children
      );

    renderHook(
      () => usePageHeader("Todo", undefined, undefined, badge),
      { wrapper: mockWrapper }
    );

    expect(mockSetPageHeader).toHaveBeenCalledWith("Todo", undefined, undefined, badge, undefined, undefined);
  });

  it("sets breadcrumbParent in context when mounted with a breadcrumbParent string", () => {
    const { result } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Users", undefined, undefined, undefined, "System Settings");
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.breadcrumbParent).toBe("System Settings");
  });

  it("sets breadcrumbParent to null in context when no breadcrumbParent is provided", () => {
    const { result } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Dashboard");
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.breadcrumbParent).toBeNull();
  });

  it("sets breadcrumbParentIcon in context when mounted with an icon component", () => {
    function StableParentIcon() { return null; }

    const { result } = renderHook(
      () => {
        const { usePageHeaderContext } = jest.requireActual(
          "@/contexts/PageHeaderContext"
        ) as typeof import("@/contexts/PageHeaderContext");
        usePageHeader("Users", undefined, undefined, undefined, "System Settings", StableParentIcon);
        return usePageHeaderContext();
      },
      { wrapper }
    );

    expect(result.current.breadcrumbParentIcon).toBe(StableParentIcon);
  });

  it("passes breadcrumbParent and breadcrumbParentIcon to setPageHeader on mount", () => {
    function StableParentIcon() { return null; }
    const mockSetPageHeader = jest.fn();
    const mockWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        PageHeaderContext.Provider,
        {
          value: {
            title: "",
            actions: null,
            icon: null,
            titleAddon: null,
            breadcrumbParent: null,
            breadcrumbParentIcon: null,
            setPageHeader: mockSetPageHeader,
          },
        },
        children
      );

    renderHook(
      () => usePageHeader("Auth Settings", undefined, undefined, undefined, "System Settings", StableParentIcon),
      { wrapper: mockWrapper }
    );

    expect(mockSetPageHeader).toHaveBeenCalledWith("Auth Settings", undefined, undefined, undefined, "System Settings", StableParentIcon);
  });

  it("clears breadcrumbParent and breadcrumbParentIcon on unmount", () => {
    function StableParentIcon() { return null; }
    const mockSetPageHeader = jest.fn();
    const mockWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        PageHeaderContext.Provider,
        {
          value: {
            title: "",
            actions: null,
            icon: null,
            titleAddon: null,
            breadcrumbParent: null,
            breadcrumbParentIcon: null,
            setPageHeader: mockSetPageHeader,
          },
        },
        children
      );

    const { unmount } = renderHook(
      () => usePageHeader("Users", undefined, undefined, undefined, "System Settings", StableParentIcon),
      { wrapper: mockWrapper }
    );

    expect(mockSetPageHeader).toHaveBeenCalledWith("Users", undefined, undefined, undefined, "System Settings", StableParentIcon);

    act(() => {
      unmount();
    });

    // Cleanup should reset the header with empty values
    expect(mockSetPageHeader).toHaveBeenLastCalledWith("", null);
  });
});
