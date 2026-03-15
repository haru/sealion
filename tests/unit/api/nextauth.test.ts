/** @jest-environment node */
// This test imports the NextAuth route handler to include it in coverage.
// The actual handler behavior is tested via integration tests.

jest.mock("@/lib/auth", () => ({
  handlers: {
    GET: jest.fn().mockReturnValue(new Response("ok")),
    POST: jest.fn().mockReturnValue(new Response("ok")),
  },
}));

describe("NextAuth route handler", () => {
  it("exports GET and POST handlers", async () => {
    const { GET, POST } = await import("@/app/api/auth/[...nextauth]/route");
    expect(GET).toBeDefined();
    expect(POST).toBeDefined();
  });
});
