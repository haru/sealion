/**
 * Unit tests for PageHeaderContext and PageHeaderProvider.
 */

import { renderHook, act } from "@testing-library/react";
import React from "react";
import {
  PageHeaderProvider,
  usePageHeaderContext,
  PageHeaderContext,
} from "@/contexts/PageHeaderContext";

describe("PageHeaderContext — default value", () => {
  it("has empty title and null actions by default", () => {
    const { result } = renderHook(() => usePageHeaderContext());
    expect(result.current.title).toBe("");
    expect(result.current.actions).toBeNull();
    expect(result.current.titleAddon).toBeNull();
  });

  it("setPageHeader is a no-op in the default context", () => {
    const { result } = renderHook(() => usePageHeaderContext());
    // Should not throw
    act(() => {
      result.current.setPageHeader("Test");
    });
  });
});

describe("PageHeaderProvider", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PageHeaderProvider>{children}</PageHeaderProvider>
  );

  it("starts with empty title and null actions", () => {
    const { result } = renderHook(() => usePageHeaderContext(), { wrapper });
    expect(result.current.title).toBe("");
    expect(result.current.actions).toBeNull();
    expect(result.current.titleAddon).toBeNull();
  });

  it("updates title when setPageHeader is called", () => {
    const { result } = renderHook(() => usePageHeaderContext(), { wrapper });

    act(() => {
      result.current.setPageHeader("Dashboard");
    });

    expect(result.current.title).toBe("Dashboard");
    expect(result.current.actions).toBeNull();
  });

  it("updates both title and actions when setPageHeader is called with actions", () => {
    const { result } = renderHook(() => usePageHeaderContext(), { wrapper });
    const actions = React.createElement("button", null, "Add");

    act(() => {
      result.current.setPageHeader("Projects", actions);
    });

    expect(result.current.title).toBe("Projects");
    expect(result.current.actions).toBe(actions);
  });

  it("clears actions when setPageHeader is called without actions argument", () => {
    const { result } = renderHook(() => usePageHeaderContext(), { wrapper });
    const actions = React.createElement("button", null, "Add");

    act(() => {
      result.current.setPageHeader("Projects", actions);
    });
    act(() => {
      result.current.setPageHeader("Settings");
    });

    expect(result.current.title).toBe("Settings");
    expect(result.current.actions).toBeNull();
  });

  it("overwrites title on subsequent calls", () => {
    const { result } = renderHook(() => usePageHeaderContext(), { wrapper });

    act(() => {
      result.current.setPageHeader("First");
    });
    act(() => {
      result.current.setPageHeader("Second");
    });

    expect(result.current.title).toBe("Second");
  });

  it("updates titleAddon when setPageHeader is called with a titleAddon node", () => {
    const { result } = renderHook(() => usePageHeaderContext(), { wrapper });
    const badge = React.createElement("span", { "data-testid": "badge" }, "synced");

    act(() => {
      result.current.setPageHeader("Dashboard", undefined, undefined, badge);
    });

    expect(result.current.titleAddon).toBe(badge);
  });

  it("clears titleAddon when setPageHeader is called without titleAddon", () => {
    const { result } = renderHook(() => usePageHeaderContext(), { wrapper });
    const badge = React.createElement("span", null, "synced");

    act(() => {
      result.current.setPageHeader("Dashboard", undefined, undefined, badge);
    });
    act(() => {
      result.current.setPageHeader("Settings");
    });

    expect(result.current.titleAddon).toBeNull();
  });
});

describe("PageHeaderContext — direct createContext shape", () => {
  it("exports a context with the expected default shape", () => {
    expect(PageHeaderContext).toBeDefined();
    // Access the default value via the _currentValue (internal React field)
    // Instead, just verify the exported object has the right structure by creating a consumer
    const { result } = renderHook(() =>
      React.useContext(PageHeaderContext)
    );
    expect(typeof result.current.setPageHeader).toBe("function");
    expect(result.current.title).toBe("");
    expect(result.current.actions).toBeNull();
    expect(result.current.titleAddon).toBeNull();
  });
});
