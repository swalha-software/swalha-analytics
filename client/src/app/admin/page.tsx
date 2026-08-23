"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The console has no landing view of its own; organizations is the first tab. */
export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/organizations");
  }, [router]);

  return null;
}
