import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";

import GravatarSection from "@/components/settings/GravatarSection";

const mockRouterRefresh = jest.fn();
const mockSessionUpdate = jest.fn().mockResolvedValue(null);

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

jest.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSession: () => ({ update: mockSessionUpdate }),
}));

function renderSection(props: { initialUseGravatar?: boolean; isLoading?: boolean } = {}) {
  return render(
    <SessionProvider>
      <GravatarSection
        initialUseGravatar={props.initialUseGravatar ?? false}
        isLoading={props.isLoading ?? false}
      />
    </SessionProvider>
  );
}

/** MUI Switch puts the data-testid on the SwitchBase <span>; the hidden input is inside it. */
function getCheckboxInput(): HTMLInputElement {
  const span = screen.getByTestId("profile-gravatar-toggle");
  return span.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("GravatarSection — rendering", () => {
  test("renders toggle switch and save button", () => {
    renderSection();
    expect(screen.getByTestId("profile-gravatar-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("profile-gravatar-save-button")).toBeInTheDocument();
  });

  test("switch reflects initialUseGravatar=false", () => {
    renderSection({ initialUseGravatar: false });
    expect(getCheckboxInput()).not.toBeChecked();
  });

  test("switch reflects initialUseGravatar=true", () => {
    renderSection({ initialUseGravatar: true });
    expect(getCheckboxInput()).toBeChecked();
  });

  test("switch is disabled while isLoading=true", () => {
    renderSection({ isLoading: true });
    expect(getCheckboxInput()).toBeDisabled();
  });

  test("save button is disabled while isLoading=true", () => {
    renderSection({ isLoading: true });
    expect(screen.getByTestId("profile-gravatar-save-button")).toBeDisabled();
  });
});

describe("GravatarSection — switch disabled during submission (#8)", () => {
  test("switch is disabled while form is submitting", async () => {
    // Delay the fetch so we can inspect the submitting state mid-flight
    let resolveFetch!: (v: unknown) => void;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => { resolveFetch = resolve; })
    );

    renderSection();
    const form = screen.getByTestId("profile-gravatar-save-button").closest("form")!;
    fireEvent.submit(form);

    // While fetch is pending, switch must be disabled
    expect(getCheckboxInput()).toBeDisabled();

    // Resolve and clean up
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({ data: null, error: null }),
      });
    });
  });
});

describe("GravatarSection — successful save", () => {
  test("shows success message and calls update + router.refresh on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: null, error: null }),
    });

    renderSection({ initialUseGravatar: false });
    const form = screen.getByTestId("profile-gravatar-save-button").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("profile-gravatar-success-message")).toBeInTheDocument();
    });

    expect(mockSessionUpdate).toHaveBeenCalledWith({ useGravatar: false });
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
  });

  test("switch is re-enabled after successful submission", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: null, error: null }),
    });

    renderSection();
    const form = screen.getByTestId("profile-gravatar-save-button").closest("form")!;

    await act(async () => { fireEvent.submit(form); });

    expect(getCheckboxInput()).not.toBeDisabled();
  });
});

describe("GravatarSection — failed save", () => {
  test("shows error message when API returns error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ data: null, error: "INTERNAL_ERROR" }),
    });

    renderSection();
    const form = screen.getByTestId("profile-gravatar-save-button").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("profile-gravatar-error-message")).toBeInTheDocument();
    });

    expect(mockSessionUpdate).not.toHaveBeenCalled();
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  test("shows error message when fetch throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    renderSection();
    const form = screen.getByTestId("profile-gravatar-save-button").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("profile-gravatar-error-message")).toBeInTheDocument();
    });
  });

  test("switch is re-enabled after failed submission", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ data: null, error: "INTERNAL_ERROR" }),
    });

    renderSection();
    const form = screen.getByTestId("profile-gravatar-save-button").closest("form")!;

    await act(async () => { fireEvent.submit(form); });

    expect(getCheckboxInput()).not.toBeDisabled();
  });
});

describe("GravatarSection — useSession integration", () => {
  test("renders without error when wrapped in SessionProvider", () => {
    // Without SessionProvider, useSession() throws and the component crashes.
    expect(() => renderSection()).not.toThrow();
  });
});
