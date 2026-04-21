import { render, screen, fireEvent } from "@testing-library/react";

import UserAvatar from "@/components/ui/UserAvatar";

const GRAVATAR_URL = "https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?s=32&d=404";

describe("UserAvatar", () => {
  describe("when gravatarUrl is not provided", () => {
    test("renders email initial in an Avatar", () => {
      render(<UserAvatar email="alice@example.com" size={32} />);
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
    });

    test("renders '?' when email is empty", () => {
      render(<UserAvatar email="" size={32} />);
      expect(screen.getByText("?")).toBeInTheDocument();
    });

    test("derives initial from local part before @", () => {
      render(<UserAvatar email="bob@domain.com" />);
      expect(screen.getByText("B")).toBeInTheDocument();
    });
  });

  describe("when gravatarUrl is provided", () => {
    test("renders an img element with the given Gravatar src", () => {
      render(<UserAvatar email="test@example.com" gravatarUrl={GRAVATAR_URL} size={32} />);
      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
      expect((img as HTMLImageElement).src).toContain("gravatar.com/avatar/");
    });

    test("falls back to email initial when onError fires", () => {
      render(<UserAvatar email="alice@example.com" gravatarUrl={GRAVATAR_URL} size={32} />);
      const img = screen.getByRole("img");
      // Simulate image load error (e.g., Gravatar 404)
      fireEvent.error(img);
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
    });

    test("renders '?' initial on error when email is empty", () => {
      render(<UserAvatar email="" gravatarUrl={GRAVATAR_URL} size={32} />);
      const img = screen.getByRole("img");
      fireEvent.error(img);
      expect(screen.getByText("?")).toBeInTheDocument();
    });
  });
});

// T019: US3 — error-state test (gravatarUrl provided, onError fires → shows initial)
describe("UserAvatar — Gravatar unregistered email fallback (US3)", () => {
  test("when gravatarUrl is provided and onError fires, renders email initial not an img", () => {
    render(<UserAvatar email="unknown@noemail.invalid" gravatarUrl={GRAVATAR_URL} size={32} />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("U")).toBeInTheDocument();
  });
});
