/** @jest-environment jsdom */
/**
 * Unit tests for SessionActivityTracker (spec 045, research R4).
 * Real user input is reported to Auth.js at most once per minute; nothing else is.
 */
import { act, render } from "@testing-library/react";

const mockUpdate = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next-auth/react", () => ({ useSession: () => ({ update: mockUpdate }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

import SessionActivityTracker, { ACTIVITY_THROTTLE_MS } from "@/components/layout/SessionActivityTracker";

const NOW = 1_700_000_000_000;
let nowSpy: jest.SpyInstance;

function fire(eventName: string) {
  return act(async () => {
    window.dispatchEvent(new Event(eventName));
  });
}

describe("SessionActivityTracker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nowSpy = jest.spyOn(Date, "now").mockReturnValue(NOW);
    mockUpdate.mockResolvedValue({ user: {} });
  });

  afterEach(() => nowSpy.mockRestore());

  it("renders nothing", () => {
    const { container } = render(<SessionActivityTracker />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["keydown", "pointerdown", "wheel", "touchstart"])(
    "reports activity on %s",
    async (eventName) => {
      render(<SessionActivityTracker />);

      await fire(eventName);

      expect(mockUpdate).toHaveBeenCalledWith({ activity: true });
    },
  );

  it("does not report passive pointer movement or other events", async () => {
    render(<SessionActivityTracker />);

    await fire("mousemove");
    await fire("pointermove");
    await fire("scroll");
    await fire("focus");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throttles to one report per minute", async () => {
    render(<SessionActivityTracker />);

    await fire("keydown");
    nowSpy.mockReturnValue(NOW + ACTIVITY_THROTTLE_MS - 1);
    await fire("keydown");
    await fire("pointerdown");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("reports again once the throttle window has passed", async () => {
    render(<SessionActivityTracker />);

    await fire("keydown");
    nowSpy.mockReturnValue(NOW + ACTIVITY_THROTTLE_MS);
    await fire("keydown");

    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("refreshes the router when the session has ended (update resolves to null)", async () => {
    mockUpdate.mockResolvedValue(null);
    render(<SessionActivityTracker />);

    await fire("keydown");

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh the router while the session is alive", async () => {
    render(<SessionActivityTracker />);

    await fire("keydown");

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("retries on the next input when update was skipped (resolves to undefined)", async () => {
    mockUpdate.mockResolvedValueOnce(undefined);
    render(<SessionActivityTracker />);

    await fire("keydown");
    await fire("keydown");

    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("logs unexpected failures, retries on the next input, and does not throw", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockUpdate.mockRejectedValueOnce(new Error("csrf fetch failed"));
    render(<SessionActivityTracker />);

    await fire("keydown");
    await fire("keydown");

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "[SessionActivityTracker] activity report failed",
      expect.objectContaining({ message: "csrf fetch failed" }),
    );
    errorSpy.mockRestore();
  });

  it("never reports in the background: no timers, focus or visibility listeners (FR-010a)", async () => {
    jest.useFakeTimers();
    render(<SessionActivityTracker />);

    jest.advanceTimersByTime(10 * 60_000);
    await fire("focus");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("stops listening when unmounted", async () => {
    const { unmount } = render(<SessionActivityTracker />);
    unmount();

    await fire("keydown");

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
