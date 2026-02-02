"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPartners } from "@/lib/partners/getPartners";
import { getFacilities } from "@/lib/facilities/getFacilities";
import type { Partner } from "@/lib/partners/getPartners";
import type { Facility } from "@/lib/facilities/getFacilities";

/**
 * Super Admin access: only if session.user.email is in SUPER_ADMIN_EMAILS (comma-separated).
 * Client-side check uses NEXT_PUBLIC_SUPER_ADMIN_EMAILS so the list is available in the browser.
 * Set in .env.local: NEXT_PUBLIC_SUPER_ADMIN_EMAILS=admin@example.com,other@example.com
 */
function isSuperAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const list = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS ?? "";
  const allowed = list.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

function comingSoon() {
  toast.info("Coming soon");
}

export default function AdminPartnersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const email = data.session?.user?.email;
      if (!data.session || !isSuperAdmin(email)) {
        router.replace("/projects");
        return;
      }
      setAllowed(true);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const partners = getPartners();
  const facilities = getFacilities();

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </AppShell>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <AppShell
      topNav={
        <Button variant="outline" size="sm" onClick={() => router.push("/projects")}>
          ← Projects
        </Button>
      }
    >
      <PageHeader
        title="Partners & Facilities"
        subtitle="Super Admin: manage partners (companies) and facilities (sites). Data is preset-only for now."
        actions={
          <Button variant="outline" size="sm" onClick={comingSoon}>
            Add (Coming soon)
          </Button>
        }
      />

      <Tabs defaultValue="partners" className="w-full">
        <TabsList>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p: Partner) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-muted-foreground">{p.id}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={comingSoon}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={comingSoon} className="text-destructive hover:text-destructive">
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {partners.length} partner(s). Add / Edit / Delete will be available when persistence is added.
          </p>
        </TabsContent>

        <TabsContent value="facilities" className="mt-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Partner ID</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Accepted streams</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilities.map((f: Facility) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-muted-foreground">{f.id}</TableCell>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>{f.type}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{f.partner_id}</TableCell>
                    <TableCell>{f.region}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={f.accepted_streams.join(", ")}>
                      {f.accepted_streams.length} stream(s)
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={comingSoon}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={comingSoon} className="text-destructive hover:text-destructive">
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {facilities.length} facility(ies). Add / Edit / Delete will be available when persistence is added.
          </p>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
