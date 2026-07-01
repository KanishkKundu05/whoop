import { NextRequest, NextResponse } from "next/server";
import { clearGarminCookies } from "@/lib/garmin/session";
import { clearWhoopCookies } from "@/lib/whoop/session";

function logout(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  clearWhoopCookies(response);
  clearGarminCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  return logout(request);
}

export async function POST(request: NextRequest) {
  return logout(request);
}
