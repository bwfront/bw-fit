"use client";

import { BarChart3, CalendarClock, Dumbbell, House, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Heute", icon: House },
  { href: "/verlauf", label: "Verlauf", icon: CalendarClock },
  { href: "/plan", label: "Plan", icon: ScrollText },
  { href: "/fortschritt", label: "Fortschritt", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/training/")) return null;
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><Icon size={21} strokeWidth={2.2} /><span>{label}</span></Link>;
      })}
      <div className="nav-mark" aria-hidden="true"><Dumbbell size={15} /></div>
    </nav>
  );
}
