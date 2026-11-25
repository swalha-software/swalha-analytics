"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { userStore } from "../lib/userStore";
import { useGetSiteIsPublic } from "../api/admin/hooks/useSites";

// /auth/consent is the OAuth consent screen MCP clients land on. Upstream also
// opens /try, /invitation, /reset-password and /transfer/<id>; here every door
// goes through SSO, and the deep link below brings a transfer recipient back.
const PUBLIC_ROUTES = ["/login", "/signup", "/auth/consent"];

export function AuthenticationGuard() {
  const { user, isPending } = userStore();
  const pathname = usePathname();

  // Extract potential siteId from path like /{siteId} or /{siteId}/something
  const pathSegments = pathname.split("/").filter(Boolean);
  const potentialSiteId = pathSegments.length > 0 && !isNaN(Number(pathSegments[0])) ? pathSegments[0] : undefined;

  // Check if there's a private key in the URL (second segment is 12 hex chars)
  const hasPrivateKey = pathSegments.length > 1 && /^[a-f0-9]{12}$/i.test(pathSegments[1]);

  // Use Tanstack Query to check if site is public
  const { data: isPublicSite, isLoading: isCheckingPublic } = useGetSiteIsPublic(potentialSiteId);

  useEffect(() => {
    // Only redirect if:
    // 1. We're not checking public status anymore
    // 2. User is not logged in
    // 3. Not on a public route
    // 4. Not on a public site
    // 5. Not using a private link key
    if (
      !isPending &&
      !isCheckingPublic &&
      !user &&
      !PUBLIC_ROUTES.includes(pathname) &&
      !isPublicSite &&
      !hasPrivateKey
    ) {
      // Carry the deep link through the SSO round trip. A document navigation keeps this page on
      // screen until /login has painted: redirect() from an effect unmounts <html> until then,
      // dropping its theme class, and the URL-state sync's history writes can discard a pending
      // router.replace().
      const next = `${pathname}${window.location.search}`;
      window.location.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
    }
  }, [isPending, user, pathname, isCheckingPublic, isPublicSite, hasPrivateKey]);

  return null; // This component doesn't render anything
}
