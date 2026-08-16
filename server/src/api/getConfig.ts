import { FastifyRequest, FastifyReply } from "fastify";
import { createRequire } from "module";
import { LITE_DASHBOARD, MAPBOX_TOKEN } from "../lib/const.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

export async function getConfig(_: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    mapboxToken: MAPBOX_TOKEN,
    liteDashboard: LITE_DASHBOARD,
  });
}

export async function getVersion(_: FastifyRequest, reply: FastifyReply) {
  return reply.send({ version });
}
