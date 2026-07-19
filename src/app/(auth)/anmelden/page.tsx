import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession, hasOwner } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasOwner())) redirect("/einrichten");
  if (await getSession()) redirect("/");
  return (
    <section className="auth-card compact">
      <div className="auth-emblem"><span /><span /><span /></div>
      <p className="eyebrow">Zugang</p>
      <h1>Anmelden</h1>
      <AuthForm mode="login" />
    </section>
  );
}
