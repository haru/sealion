/**
 * Lifecycle helpers for `oauth2-mock-server`, used by the OIDC E2E suite to
 * stand up a self-contained OIDC IdP on `http://localhost:<port>`.
 */

import { OAuth2Server } from "oauth2-mock-server";

export interface MockIdp {
  readonly issuer: string;
  readonly port: number;
  stop: () => Promise<void>;
}

/**
 * Starts an in-process OAuth2 mock server seeded with one signing key, with the
 * default `/.well-known/openid-configuration` discovery document available.
 *
 * @param port - The port to bind. Defaults to `8089`.
 * @returns A {@link MockIdp} handle the caller MUST `stop()` in the teardown hook.
 */
export async function startMockIdp(port: number = 8089): Promise<MockIdp> {
  const server = new OAuth2Server();
  await server.issuer.keys.generate("RS256");
  await server.start(port, "127.0.0.1");

  return {
    issuer: `http://127.0.0.1:${port}`,
    port,
    async stop() {
      await server.stop();
    },
  };
}
