import { FastifyReply, FastifyRequest } from "fastify";
import { EMAIL_ENABLED, EMAIL_FROM } from "../../lib/const.js";
import { weeklyReportService } from "../../services/weekyReports/weeklyReportService.js";

/**
 * Mail configuration and the weekly report schedule, for the admin panel.
 */
export async function getWeeklyReportStatus(_: FastifyRequest, res: FastifyReply) {
  return res.send({
    emailEnabled: EMAIL_ENABLED,
    sender: EMAIL_ENABLED ? EMAIL_FROM : null,
    schedule: "0 0 * * 1",
    scheduleLabel: "Mondays at 00:00 UTC",
  });
}

/**
 * Sends this week's reports to the requesting admin only, for the
 * organizations they own. A rehearsal of Monday's run against one inbox.
 */
export async function runWeeklyReport(req: FastifyRequest, res: FastifyReply) {
  if (!EMAIL_ENABLED) {
    return res.status(400).send({ error: "Email is not configured. Set RESEND_API_KEY to enable reports." });
  }

  const user = req.user;
  if (!user?.id || !user.email) {
    return res.status(401).send({ error: "Unauthorized" });
  }

  try {
    const { organizations, emails } = await weeklyReportService.sendReportsToUser(
      user.id,
      user.email,
      user.name ?? user.email
    );

    return res.send({ recipient: user.email, organizations, emails });
  } catch (error) {
    req.log.error({ err: error }, "Failed to send test weekly report");
    return res.status(500).send({ error: "Failed to send test weekly report" });
  }
}
