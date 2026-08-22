import { DateTime } from "luxon";
import Stripe from "stripe";
import { DEFAULT_EVENT_LIMIT, getStripePrices } from "../../lib/const.js";
import { stripe } from "../../lib/stripe.js";
import { getAllStripeSubscriptionsByCustomer } from "../../lib/subscriptionUtils.js";

export interface SubscriptionData {
  id: string;
  planName: string;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  eventLimit?: number;
  interval?: string;
}

/**
 * Projects a raw Stripe subscription into the admin SubscriptionData shape. Unlike the app-facing
 * lookup, the admin view keeps non-active subscriptions (canceled/past_due) so it can display them.
 */
function buildAdminSubscriptionData(
  subscription: Stripe.Subscription,
  includeFullDetails: boolean
): SubscriptionData | null {
  const subscriptionItem = subscription.items.data[0];
  const priceId = subscriptionItem?.price.id;

  if (!priceId) {
    return null;
  }

  const planDetails = getStripePrices().find(plan => plan.priceId === priceId);

  const data: SubscriptionData = {
    id: subscription.id,
    planName: planDetails?.name || "Unknown Plan",
    status: subscription.status,
  };

  if (includeFullDetails) {
    data.currentPeriodStart = new Date(subscriptionItem.current_period_start * 1000);
    data.currentPeriodEnd = new Date(subscriptionItem.current_period_end * 1000);
    data.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    data.eventLimit = planDetails?.limits.events || 0;
    data.interval = subscriptionItem.price.recurring?.interval ?? "unknown";
  }

  return data;
}

/**
 * Fetches subscription data for multiple Stripe customer IDs.
 *
 * Rather than one Stripe request per customer, this reads from a single cached account-wide
 * snapshot (a handful of paginated requests for the whole account) and picks out the customers
 * we care about — so admin loads don't scale Stripe calls with the customer count or refetch rate.
 * @param stripeCustomerIds Set of Stripe customer IDs to fetch subscriptions for
 * @param includeFullDetails Whether to include full subscription details (periods, limits, etc.)
 * @returns Map of customer ID to subscription data
 */
async function fetchSubscriptionsForCustomers(
  stripeCustomerIds: Set<string>,
  includeFullDetails = false
): Promise<Map<string, SubscriptionData>> {
  const subscriptionMap = new Map<string, SubscriptionData>();

  if (!stripe || stripeCustomerIds.size === 0) {
    return subscriptionMap;
  }

  let snapshot: Map<string, Stripe.Subscription>;
  try {
    snapshot = await getAllStripeSubscriptionsByCustomer();
  } catch (error) {
    // Bulk fetch failed (e.g. rate limit) — render orgs as free for this load rather than
    // failing the whole admin page. The next load retries once the snapshot can refresh.
    console.error("Error fetching Stripe subscriptions in bulk:", error);
    return subscriptionMap;
  }

  for (const customerId of stripeCustomerIds) {
    const subscription = snapshot.get(customerId);
    if (!subscription) {
      continue;
    }
    const value = buildAdminSubscriptionData(subscription, includeFullDetails);
    if (value) {
      subscriptionMap.set(customerId, value);
    }
  }

  return subscriptionMap;
}

/**
 * Creates a map of organization IDs to their subscription data
 * @param organizations Array of organization objects with id and stripeCustomerId
 * @param includeFullDetails Whether to include full subscription details
 * @returns Map of organization ID to subscription data with fallback to free plan
 */
export async function getOrganizationSubscriptions(
  organizations: Array<{ id: string; stripeCustomerId?: string | null }>,
  includeFullDetails = false
): Promise<
  Map<string, SubscriptionData & { planName: string; status: string; eventLimit: number; currentPeriodEnd: Date }>
> {
  const orgsWithStripe = organizations.filter(org => org.stripeCustomerId);
  const stripeCustomerIds = new Set(orgsWithStripe.map(org => org.stripeCustomerId!));

  const stripeSubscriptionMap = await fetchSubscriptionsForCustomers(stripeCustomerIds, includeFullDetails);

  // Create organization map with subscription data
  const orgSubscriptionMap = new Map<
    string,
    SubscriptionData & { planName: string; status: string; eventLimit: number; currentPeriodEnd: Date }
  >();

  const nextMonthStart = DateTime.now().startOf("month").plus({ months: 1 }).toJSDate();

  for (const org of organizations) {
    const stripeData = org.stripeCustomerId ? stripeSubscriptionMap.get(org.stripeCustomerId) : null;

    if (stripeData) {
      orgSubscriptionMap.set(org.id, {
        ...stripeData,
        planName: stripeData.planName || "free",
        status: stripeData.status || "free",
        eventLimit: stripeData.eventLimit ?? 0,
        currentPeriodEnd: stripeData.currentPeriodEnd ?? new Date(),
      });
    } else {
      // Free plan with all required fields
      orgSubscriptionMap.set(org.id, {
        id: "",
        planName: "free",
        status: "free",
        eventLimit: DEFAULT_EVENT_LIMIT,
        currentPeriodEnd: nextMonthStart,
      });
    }
  }

  return orgSubscriptionMap;
}
