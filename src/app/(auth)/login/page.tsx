import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { LoginForm } from "./LoginForm";

/**
 * Login page — server component.
 *
 * Redirects to `/setup` when no users exist in the database (first-time setup).
 * Otherwise renders the login form.
 */
export default async function LoginPage() {
  const count = await prisma.user.count();
  if (count === 0) {
    redirect("/setup");
  }

  return <LoginForm />;
}
