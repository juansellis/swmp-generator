import { NextResponse } from "next/server";

export async function GET() {
  // This route is not used - email confirmation is handled by Supabase
  // Redirect to login page
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}
