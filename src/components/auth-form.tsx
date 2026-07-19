"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "setup" | "login" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const result = mode === "setup"
      ? await authClient.signUp.email({ email, password, name: String(data.get("name")) || "Besitzer" })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(mode === "setup" ? "Einrichtung fehlgeschlagen. Prüfe E-Mail und Passwort." : "E-Mail oder Passwort stimmt nicht.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="auth-form">
      {mode === "setup" && <label>Name<input name="name" autoComplete="name" required placeholder="Dein Name" /></label>}
      <label>E-Mail<input name="email" type="email" inputMode="email" autoComplete="email" required placeholder="du@zuhause.de" /></label>
      <label>Passwort<input name="password" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} minLength={10} required placeholder="Mindestens 10 Zeichen" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary full" disabled={pending}>{pending ? "Einen Moment…" : mode === "setup" ? "Kraftbuch einrichten" : "Anmelden"}</button>
    </form>
  );
}
