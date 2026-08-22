"use client";

import { useExtracted } from "next-intl";
import { useOrgApiUsage } from "../../../../api/admin/hooks/useOrgApiUsage";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** Today's request usage for this organization's keys. Cloud only — self-hosted
 *  deployments don't meter API requests, and the endpoint says so. */
export function ApiUsage({ organizationId }: { organizationId: string }) {
  const t = useExtracted();
  const { data: usage } = useOrgApiUsage(organizationId);

  if (!usage?.metered) return null;

  const used = usage.available ? usage.dailyUsed.toLocaleString() : "—";
  const resetsInHours = Math.max(1, Math.round(usage.resetsInSeconds / 3600));

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">{t("Usage")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label={t("Requests today")} value={`${used} / ${usage.dailyLimit.toLocaleString()}`} />
          <Stat
            label={t("Burst limit")}
            value={t("{count} / {seconds}s", {
              count: usage.burstLimit.toLocaleString(),
              seconds: String(usage.burstWindowSeconds),
            })}
          />
          <Stat
            label={t("Quota resets in")}
            value={t("{count, plural, one {# hour} other {# hours}}", { count: resetsInHours })}
          />
        </div>
        {!usage.available && (
          <p className="text-xs text-neutral-500">
            {t("The counter could not be read right now. The quota is still enforced.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
