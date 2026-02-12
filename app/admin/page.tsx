"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ADMIN_LINKS = [
  { href: "/admin/partners", title: "Partners", description: "Manage partners (companies)." },
  { href: "/admin/facilities", title: "Facilities", description: "Manage facilities (sites) and accepted streams." },
  { href: "/admin/users", title: "Users", description: "View and manage authenticated users." },
] as const;

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader
        title="Admin"
        subtitle={
          <span>
            Super Admin: manage partners, facilities, and users.{" "}
            <Badge variant="secondary">Protected</Badge>
          </span>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_LINKS.map(({ href, title, description }) => (
          <Card key={href}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
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
