import { BottomNav } from "@/components/bottom-nav";
import { requireOwner } from "@/lib/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return <><div className="app-shell">{children}</div><BottomNav /></>;
}
