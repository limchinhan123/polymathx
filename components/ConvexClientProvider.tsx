"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
    if (!url && typeof window !== "undefined") {
      console.warn(
        "NEXT_PUBLIC_CONVEX_URL is not set. Add it to .env.local (see Convex dashboard after npx convex dev)."
      );
    }
    return new ConvexReactClient(url);
  }, []);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
