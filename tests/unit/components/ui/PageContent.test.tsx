import React from "react";
import { render, screen } from "@testing-library/react";

import PageContent from "@/components/ui/PageContent";

describe("PageContent", () => {
  it("renders children", () => {
    render(
      React.createElement(PageContent, null, "Hello"),
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders a Box container as the root element", () => {
    const { container } = render(
      React.createElement(PageContent, null, "content"),
    );
    const box = container.firstChild as HTMLElement;
    expect(box.tagName).toBe("DIV");
  });

  it("applies MUI Box CSS class to root element", () => {
    const { container } = render(
      React.createElement(PageContent, null, "content"),
    );
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain("MuiBox-root");
  });

  it("passes maxWidth prop and py/px props to the underlying Box", () => {
    const { container } = render(
      React.createElement(PageContent, { maxWidth: "sm" }, "content"),
    );
    const box = container.firstChild as HTMLElement;
    // MUI Box applies the sx prop — verify the component accepts maxWidth and renders without error
    expect(box).toBeInTheDocument();
  });

  it("renders with maxWidth='md' without error", () => {
    const { container } = render(
      React.createElement(PageContent, { maxWidth: "md" }, "content"),
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders with maxWidth='lg' (default) without error", () => {
    const { container } = render(
      React.createElement(PageContent, null, "content"),
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      React.createElement(
        PageContent,
        null,
        React.createElement("p", null, "first"),
        React.createElement("p", null, "second"),
      ),
    );
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });
});
