"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AccountControls() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const result = await authClient.changePassword({
      currentPassword: String(data.get("currentPassword")),
      newPassword: String(data.get("newPassword")),
      revokeOtherSessions: true,
    });
    setPending(false);
    if (result.error) setMessage("Passwort konnte nicht geändert werden.");
    else {
      setMessage("Passwort geändert.");
      event.currentTarget.reset();
    }
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/anmelden");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={changePassword} className="settings-form">
        <label>Aktuelles Passwort<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label>Neues Passwort<input name="newPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="button steel" disabled={pending}>{pending ? "Ändere…" : "Passwort ändern"}</button>
      </form>
      <button className="button danger full" type="button" onClick={signOut}><LogOut size={17} />Abmelden</button>
    </>
  );
}
