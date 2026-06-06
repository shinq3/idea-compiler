import { defineConfig } from "drizzle-kit";

const { RDS_ENDPOINT, RDS_USER, RDS_PASSWORD } = process.env;

if (!RDS_ENDPOINT || !RDS_USER || !RDS_PASSWORD) {
  throw new Error("RDS_ENDPOINT, RDS_USER and RDS_PASSWORD must be set");
}

const RDS_DATABASE = process.env.RDS_DATABASE || "ideacompiler";

const idx = RDS_ENDPOINT.lastIndexOf(":");
let host = RDS_ENDPOINT;
let port = 5432;
if (idx !== -1) {
  host = RDS_ENDPOINT.slice(0, idx);
  port = parseInt(RDS_ENDPOINT.slice(idx + 1), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port in RDS_ENDPOINT: "${RDS_ENDPOINT}"`);
  }
}

const ssl = process.env.RDS_CA_CERT
  ? { rejectUnauthorized: true, ca: process.env.RDS_CA_CERT }
  : { rejectUnauthorized: false };

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host,
    port,
    user: RDS_USER,
    password: RDS_PASSWORD,
    database: RDS_DATABASE,
    ssl,
  },
});
