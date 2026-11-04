// Reusable Prisma Client instance for the FridgePolice backend.
//
// Prisma 7 uses a driver adapter for PostgreSQL. We create the adapter
// with DATABASE_URL and pass it to PrismaClient.
//
// In development, nodemon can reload modules many times. Storing the
// client on globalThis avoids creating a new connection pool on every
// reload.

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Ensure Neon variables are available even when this module is imported directly.
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const globalForPrisma = globalThis;

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to server/.env");
  }

  const adapter = new PrismaPg(process.env.DATABASE_URL);

  const transactionOptions = {};
  if (process.env.PRISMA_TRANSACTION_TIMEOUT) {
    transactionOptions.timeout = Number(process.env.PRISMA_TRANSACTION_TIMEOUT);
    transactionOptions.maxWait = Math.max(5000, Number(process.env.PRISMA_TRANSACTION_TIMEOUT) / 2);
  } else if (process.env.NODE_ENV === "test" || process.env.TEST_DATABASE_URL) {
    // Accommodate network round-trip latency when running integration test suites
    // against remote cloud databases (Neon) without affecting production defaults.
    transactionOptions.timeout = 25000;
    transactionOptions.maxWait = 10000;
  }

  return new PrismaClient({
    adapter,
    ...(Object.keys(transactionOptions).length > 0 ? { transactionOptions } : {}),
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
export { prisma };
