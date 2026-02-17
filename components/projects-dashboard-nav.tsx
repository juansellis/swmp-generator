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
import { Settings, User, LogOut, LayoutDashboard, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectsDashboardNavProps {
  /** Page title in the nav bar (e.g. "Projects") */
  title: string;
  userEmail: string | null;
  isSuperAdmin: boolean;
  onNewProject: () => void;
  onSignOut: () => void;
  className?: string;
}

export function ProjectsDashboardNav({
  title,
  userEmail,
  isSuperAdmin,
  onNewProject,
  onSignOut,
  className,
}: ProjectsDashboardNavProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-4",
        className
      )}
    >
      <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-2">
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
