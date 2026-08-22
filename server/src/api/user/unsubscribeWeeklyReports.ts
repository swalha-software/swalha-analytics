import { eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import { DateTime } from "luxon";
import { db } from "../../db/postgres/postgres.js";
import { user } from "../../db/postgres/schema.js";

// One-click opt-out for the weekly site reports, linked from the email itself
// (account settings moved to SWALHA Auth, so there is no in-app toggle).
// Same shape as the marketing one-click endpoint: GET shows a confirmation
// page, POST serves List-Unsubscribe-Post.
export const unsubscribeWeeklyReports = async (
  request: FastifyRequest<{ Querystring: { email?: string } }>,
  reply: FastifyReply
) => {
  const email = request.query.email;
  const isGetRequest = request.method === "GET";

  if (!email) {
    if (isGetRequest) {
      return reply
        .status(400)
        .type("text/html")
        .send(page("Invalid Request", "Email address is required to unsubscribe."));
    }
    return reply.status(400).send({ error: "Email is required" });
  }

  try {
    await db
      .update(user)
      .set({ sendAutoEmailReports: false, updatedAt: DateTime.now().toISO() })
      .where(eq(user.email, email));

    if (isGetRequest) {
      return reply
        .status(200)
        .type("text/html")
        .send(page("Unsubscribed", `${email} will no longer receive weekly reports from Swalha Analytics.`));
    }
    return reply.status(200).send({ success: true });
  } catch (error) {
    request.log.error({ err: error }, "Error unsubscribing from weekly reports");
    if (isGetRequest) {
      return reply.status(500).type("text/html").send(page("Something went wrong", "Please try again later."));
    }
    return reply.status(500).send({ error: "Failed to unsubscribe" });
  }
};

function page(title: string, body: string) {
  return `<!DOCTYPE html>
<html><head><title>${title} - Swalha Analytics</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
  <h1>${title}</h1>
  <p>${body}</p>
</body></html>`;
}
