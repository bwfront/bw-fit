import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { hasOwner } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasOwner()) redirect("/anmelden");
  return (
    <section className="auth-card">
      <div className="auth-emblem"><span /><span /><span /></div>
      <p className="eyebrow">Ersteinrichtung</p>
      <h1>Zugang<br />anlegen</h1>
      <p className="lede">Lege den einzigen Zugang an. Die Daten werden auf diesem Server gespeichert.</p>
      <AuthForm mode="setup" />
    </section>
  );
}
