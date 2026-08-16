"use client";

import { useSendTestWeeklyReport, useWeeklyReportStatus } from "@/api/admin/hooks/useWeeklyReport";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { DateTime } from "luxon";
import { Mail, Send } from "lucide-react";
import { ReactNode } from "react";
import { Panel } from "../shared/Panel";

/** Next Monday 00:00 UTC — the cron is "0 0 * * 1" pinned to UTC. */
function nextRun(): DateTime {
  const now = DateTime.utc();
  const daysAhead = (8 - now.weekday) % 7 || 7;
  return now.plus({ days: daysAhead }).startOf("day");
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm border-b border-neutral-100 last:border-0 dark:border-neutral-850">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}

export function Email() {
  const { data: status, isLoading } = useWeeklyReportStatus();
  const sendTest = useSendTestWeeklyReport();

  const handleSendTest = () => {
    sendTest.mutate(undefined, {
      onSuccess: result => {
        if (result.emails === 0) {
          toast.info(
            "Nothing to send — you own no organizations with a site that had traffic in the last 7 days."
          );
          return;
        }
        toast.success(
          `Sent ${result.emails} report${result.emails === 1 ? "" : "s"} to ${result.recipient} across ${result.organizations} organization${result.organizations === 1 ? "" : "s"}.`
        );
      },
      onError: (error: Error) => toast.error(error.message || "Failed to send test report"),
    });
  };

  const run = nextRun();

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold">Email</h2>

      <Panel
        title="Weekly reports"
        actions={
          <Button size="sm" variant="outline" onClick={handleSendTest} disabled={!status?.emailEnabled || sendTest.isPending}>
            <Send className="size-3.5" />
            {sendTest.isPending ? "Sending..." : "Send test to me"}
          </Button>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            <Row label="Status">
              {status?.emailEnabled ? (
                <span className="text-green-600 dark:text-green-500">Enabled</span>
              ) : (
                <span className="text-neutral-500 dark:text-neutral-400">Disabled — no RESEND_API_KEY set</span>
              )}
            </Row>
            <Row label="Sender">
              <span className="font-mono text-xs">{status?.sender ?? "-"}</span>
            </Row>
            <Row label="Schedule">{status?.scheduleLabel ?? "-"}</Row>
            <Row label="Next run">
              <span title={run.toISO() ?? undefined}>
                {run.toFormat("cccc d LLLL, HH:mm 'UTC'")}
                <span className="ms-2 text-neutral-500 dark:text-neutral-400">({run.toRelative()})</span>
              </span>
            </Row>
            <Row label="Recipients">Organization owners who have not opted out, one email per site</Row>

            <p className="mt-4 flex gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <Mail className="mt-0.5 size-3.5 shrink-0" />
              <span>
                &ldquo;Send test to me&rdquo; runs the real report against the organizations you own and delivers it to
                your own address only — nobody else is emailed. Sites with no traffic in the last 7 days are skipped,
                same as the scheduled run.
              </span>
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
