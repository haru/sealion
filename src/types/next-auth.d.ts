import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
      useGravatar: boolean;
    };
  }

  interface User {
    role?: string;
    useGravatar?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    useGravatar?: boolean;
    /** Epoch ms of the original sign-in. App-owned: Auth.js overwrites `iat`, so this is used instead. */
    authTime?: number;
    /** Epoch ms of the last real user interaction. App-owned; see ADR 0006. */
    lastActivityAt?: number;
  }
}
