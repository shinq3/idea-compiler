import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { RDS_ENDPOINT, RDS_USER, RDS_PASSWORD } = process.env;

if (!RDS_ENDPOINT || !RDS_USER || !RDS_PASSWORD) {
  throw new Error(
    "RDS_ENDPOINT, RDS_USER and RDS_PASSWORD must be set to connect to the Lightsail/RDS database.",
  );
}

const RDS_DATABASE = process.env.RDS_DATABASE || "ideacompiler";

function parseEndpoint(endpoint: string): { host: string; port: number } {
  const idx = endpoint.lastIndexOf(":");
  if (idx === -1) {
    return { host: endpoint, port: 5432 };
  }
  const host = endpoint.slice(0, idx);
  const port = parseInt(endpoint.slice(idx + 1), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port in RDS_ENDPOINT: "${endpoint}"`);
  }
  return { host, port };
}

const { host, port } = parseEndpoint(RDS_ENDPOINT);

const ssl = process.env.RDS_CA_CERT
  ? { rejectUnauthorized: true, ca: process.env.RDS_CA_CERT }
  : { rejectUnauthorized: false };

export const pool = new pg.Pool({
  host,
  port,
  user: RDS_USER,
  password: RDS_PASSWORD,
  database: RDS_DATABASE,
  ssl,
  max: 10,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
