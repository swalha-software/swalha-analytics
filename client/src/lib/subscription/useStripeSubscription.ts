import { authClient } from "@/lib/auth";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { authedFetch } from "../../api/utils";
import { IS_CLOUD } from "../const";

export interface SubscriptionData {
  id: string;
  planName: string;
  status: "expired" | "active" | "trialing" | "free";
  currentPeriodEnd: string;
  currentPeriodStart: string;
  createdAt: string;
  monthlyEventCount: number;
  eventLimit: number;
  interval: string;
  cancelAtPeriodEnd: boolean;
  isTrial?: boolean;
  trialDaysRemaining?: number;
  message?: string; // For expired trial message
  isOverride?: boolean;
  memberLimit: number | null;
  siteLimit: number | null;
}

export function useStripeSubscription(): UseQueryResult<SubscriptionData | null, Error> {
  const { data: activeOrg } = authClient.useActiveOrganization();

  const fetchSubscription = async () => {
    if (!activeOrg || !IS_CLOUD) {
      // React Query rejects undefined query data; null means "no subscription".
      return null;
    }

    return authedFetch<SubscriptionData>(`/stripe/subscription?organizationId=${activeOrg.id}`);
  };

  return useQuery<SubscriptionData | null>({
    queryKey: ["stripe-subscription", activeOrg?.id],
    queryFn: fetchSubscription,
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!activeOrg && IS_CLOUD,
  });
}
