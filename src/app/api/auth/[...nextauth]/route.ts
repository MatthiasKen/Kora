import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { storeConfig } from "@/lib/config";

type AuthContext = { params: Promise<{ nextauth: string[] }> };

async function handler(request: NextRequest, context: AuthContext) {
  if (!storeConfig().googleEnabled) {
    const { nextauth } = await context.params;
    const headers = { "Cache-Control": "no-store" };
    // NextAuth's client normalizes an empty object into a guest session.
    if (request.method === "GET" && nextauth[0] === "session")
      return Response.json({}, { headers });
    if (request.method === "GET" && nextauth[0] === "providers")
      return Response.json({}, { headers });
    return Response.json(
      { error: "Google sign-in is not configured. Please contact the store owner." },
      { status: 503, headers },
    );
  }
  return NextAuth(authOptions)(request, context);
}

export { handler as GET, handler as POST };
