"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export type ThemePreference = "auto" | "light" | "dark";

const options: { value: ThemePreference; label: string; icon: typeof Laptop }[] = [
  { value: "auto", label: "Automatisch", icon: Laptop },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
];

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = preference;

  const dark = preference === "dark" || (preference === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = dark ? "#111920" : "#e9edf1";
  });
}

export function ThemePreferenceControl() {
  const [preference, setPreference] = useState<ThemePreference>("auto");

  useEffect(() => {
    const saved = window.localStorage.getItem("bw-fit-theme");
    const initial = saved === "light" || saved === "dark" ? saved : "auto";
    applyTheme(initial);
    const frame = window.requestAnimationFrame(() => setPreference(initial));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncAutomaticTheme = () => {
      if ((window.localStorage.getItem("bw-fit-theme") ?? "auto") === "auto") applyTheme("auto");
    };
    media.addEventListener("change", syncAutomaticTheme);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", syncAutomaticTheme);
    };
  }, []);

  function choose(next: ThemePreference) {
    setPreference(next);
    if (next === "auto") window.localStorage.removeItem("bw-fit-theme");
    else window.localStorage.setItem("bw-fit-theme", next);
    applyTheme(next);
  }

  return (
    <div className="theme-choice" role="group" aria-label="Farbschema auswählen">
      {options.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" aria-pressed={preference === value} onClick={() => choose(value)}>
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
