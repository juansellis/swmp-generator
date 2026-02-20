"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/partners", label: "Partners" },
  { href: "/admin/facilities", label: "Facilities" },
  { href: "/admin/materials", label: "Waste Streams" },
  { href: "/admin/conversions", label: "Conversion factors" },
  { href: "/admin/carbon", label: "Carbon factors" },
  { href: "/admin/users", label: "Users" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AppShell
      topNav={
        <Button variant="outline" size="sm" asChild>
          <Link href="/projects">← Projects</Link>
        </Button>
      }
    >
      <div className="flex gap-6">
        <aside className="w-52 shrink-0">
          <nav className="sticky top-20 flex flex-col gap-1 rounded-lg border bg-card p-2">
            {ADMIN_NAV.map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {label}
                </span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
