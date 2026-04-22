"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, User, LogOut, LayoutDashboard, UserCircle, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CreditsDisplay {
  siteCreditsBalance: number;
  freeSiteUsed: boolean;
}

export interface ProjectsDashboardNavProps {
  /** Page title in the nav bar (e.g. "Projects") */
  title: string;
  userEmail: string | null;
  isSuperAdmin: boolean;
  /** If provided, shows "Credits: X" or "Free site available" and link to billing */
  creditsDisplay?: CreditsDisplay | null;
  onNewProject: () => void;
  onSignOut: () => void;
  className?: string;
}

export function ProjectsDashboardNav({
  title,
  userEmail,
  isSuperAdmin,
  creditsDisplay,
  onNewProject,
  onSignOut,
  className,
}: ProjectsDashboardNavProps) {
  const router = useRouter();
  const creditsLabel =
    creditsDisplay == null
      ? null
      : !creditsDisplay.freeSiteUsed
        ? "Free site available"
        : `Credits: ${creditsDisplay.siteCreditsBalance}`;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-6 sm:gap-8",
        className
      )}
    >
      {/* Nav: current page as active tab with brand accent */}
      <div className="flex items-center min-w-0">
        <span
          className="text-base font-semibold tracking-tight text-primary border-b-2 border-primary pb-0.5 truncate"
          aria-current="page"
        >
          {title}
        </span>
      </div>
      <div className="flex-1 min-w-0" aria-hidden />
      <div className="flex shrink-0 items-center gap-2">
        {creditsLabel != null ? (
          <Button variant="outline" size="default" asChild className="gap-1.5">
            <Link href="/billing">
              <CreditCard className="size-4" />
              <span className="hidden sm:inline">{creditsLabel}</span>
            </Link>
          </Button>
        ) : null}
        <Button variant="primary" size="default" onClick={onNewProject}>
          New project
        </Button>
        {isSuperAdmin && (
          <Button
            variant="outline"
            size="default"
            onClick={() => router.push("/admin")}
            aria-label="Management (super admin)"
          >
            <LayoutDashboard className="size-4 mr-1.5" />
            Management
          </Button>
        )}
        <Button variant="outline" size="icon" asChild aria-label="Brand settings">
          <Link href="/settings/brand">
            <Settings className="size-4" />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="gap-2">
              <User className="size-4" />
              <span className="hidden max-w-[120px] truncate sm:inline">
                {userEmail ?? "Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {userEmail ? (
              <div className="px-2 py-2 text-sm text-muted-foreground truncate">
                {userEmail}
              </div>
            ) : null}
            {creditsLabel != null ? (
              <DropdownMenuItem asChild>
                <Link href="/billing" className="gap-2">
                  <CreditCard className="size-4" />
                  <span className="truncate">{creditsLabel}</span>
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/profile" className="gap-2">
                <UserCircle className="size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut} className="gap-2">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
