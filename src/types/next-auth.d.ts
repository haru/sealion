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
  }
}
