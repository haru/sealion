/** @jest-environment jsdom */
/**
 * Unit test: DashboardShell mounts the SessionActivityTracker inside the session provider (spec 045),
 * so both the dashboard and the admin pages report user activity.
 */
import { render } from "@testing-library/react";

jest.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="session-provider">{children}</div>,
}));
jest.mock("@/components/MessageQueue", () => ({
  MessageQueueProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/contexts/PageHeaderContext", () => ({
  PageHeaderProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/layout/DashboardShellInner", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
jest.mock("@/components/layout/SessionActivityTracker", () => ({
  __esModule: true,
  default: () => <span data-testid="activity-tracker" />,
}));

import DashboardShell from "@/components/layout/DashboardShell";

describe("DashboardShell", () => {
  it("mounts the activity tracker inside the session provider", () => {
    const { getByTestId } = render(
      <DashboardShell email="u@ex.com" role="USER">
        <p>content</p>
      </DashboardShell>,
    );

    expect(getByTestId("session-provider")).toContainElement(getByTestId("activity-tracker"));
  });
});
