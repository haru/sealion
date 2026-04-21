import { render, screen, fireEvent } from "@testing-library/react";

import UserAvatar from "@/components/ui/UserAvatar";

describe("UserAvatar", () => {
  describe("when useGravatar=false", () => {
    test("renders email initial in an Avatar", () => {
      render(<UserAvatar email="alice@example.com" useGravatar={false} size={32} />);
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
    });

    test("renders '?' when email is empty", () => {
      render(<UserAvatar email="" useGravatar={false} size={32} />);
      expect(screen.getByText("?")).toBeInTheDocument();
    });

    test("derives initial from local part before @", () => {
      render(<UserAvatar email="bob@domain.com" useGravatar={false} />);
      expect(screen.getByText("B")).toBeInTheDocument();
    });
  });

  describe("when useGravatar=true", () => {
    test("renders an img element with Gravatar src", () => {
      render(<UserAvatar email="test@example.com" useGravatar={true} size={32} />);
      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
      expect((img as HTMLImageElement).src).toContain("gravatar.com/avatar/");
    });

    test("falls back to email initial when onError fires", () => {
      render(<UserAvatar email="alice@example.com" useGravatar={true} size={32} />);
      const img = screen.getByRole("img");
      // Simulate image load error (e.g., Gravatar 404)
      fireEvent.error(img);
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
    });

    test("renders '?' initial on error when email is empty", () => {
      render(<UserAvatar email="" useGravatar={true} size={32} />);
      const img = screen.getByRole("img");
      fireEvent.error(img);
      expect(screen.getByText("?")).toBeInTheDocument();
    });
  });
});

// T019: US3 — error-state test (useGravatar=true, onError fires → shows initial)
describe("UserAvatar — Gravatar unregistered email fallback (US3)", () => {
  test("when useGravatar=true and onError fires, renders email initial not an img", () => {
    render(<UserAvatar email="unknown@noemail.invalid" useGravatar={true} size={32} />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("U")).toBeInTheDocument();
  });
});
