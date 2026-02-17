"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AdminStats = {
  partners: number;
  facilities: number;
  materials: number;
  conversions: number;
  users: number;
};

const ADMIN_LINKS: { href: string; title: string; description: string; countKey: keyof AdminStats }[] = [
  { href: "/admin/partners", title: "Partners", description: "Manage partners (companies).", countKey: "partners" },
  { href: "/admin/facilities", title: "Facilities", description: "Manage facilities (sites) and accepted streams.", countKey: "facilities" },
  { href: "/admin/materials", title: "Waste Streams", description: "Canonical waste streams for Inputs, Facilities, Forecast.", countKey: "materials" },
  { href: "/admin/conversions", title: "Conversion factors", description: "Per-material unit conversion (m, m³ → kg).", countKey: "conversions" },
  { href: "/admin/users", title: "Users", description: "View and manage authenticated users.", countKey: "users" },
];

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle={
          <span>
            Super Admin: manage partners, facilities, materials, conversions, and users.{" "}
            <Badge variant="secondary">Protected</Badge>
          </span>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_LINKS.map(({ href, title, description, countKey }) => (
          <Card key={href}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {title}
                {stats != null && (
                  <Badge variant="secondary" className="font-normal">
                    {stats[countKey]}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link href={href}>Open {title}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
