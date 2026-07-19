import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { hasOwner } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasOwner()) redirect("/anmelden");
  return (
    <section className="auth-card">
      <div className="auth-emblem"><span /><span /><span /></div>
      <p className="eyebrow">Erster Start</p>
      <h1>Dein Training.<br />Unter deiner Kontrolle.</h1>
      <p className="lede">Lege den einzigen Zugang an. Deine Daten bleiben auf deinem Server.</p>
      <AuthForm mode="setup" />
    </section>
  );
}
