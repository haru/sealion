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
});
