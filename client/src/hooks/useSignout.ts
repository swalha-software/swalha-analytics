import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth";
import { BACKEND_URL } from "../lib/const";

// Sign out of the whole SWALHA platform: end the Auth session first (server
// to server, best effort), then the local one. /login?signed_out=1 keeps the
// login page from bouncing straight back to Auth.
export function useSignout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    try {
      await fetch(`${BACKEND_URL}/user/sso-sign-out`, { method: "POST", credentials: "include" });
    } catch {
      // local sign-out still proceeds
    }
    queryClient.clear();
    await authClient.signOut();
    router.push("/login?signed_out=1");
  };
}
