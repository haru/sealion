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
            setPageHeader: mockSetPageHeader,
          },
        },
        children
      );

    const { unmount } = renderHook(() => usePageHeader("Temp"), {
      wrapper: mockWrapper,
    });

    // On mount, setPageHeader should have been called with the title
    expect(mockSetPageHeader).toHaveBeenCalledWith("Temp", undefined, undefined);

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
            setPageHeader: mockSetPageHeader,
          },
        },
        children
      );

    const { unmount } = renderHook(
      () => usePageHeader("Providers", undefined, StableMockIcon),
      { wrapper: mockWrapper }
    );

    expect(mockSetPageHeader).toHaveBeenCalledWith("Providers", undefined, StableMockIcon);

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
});
