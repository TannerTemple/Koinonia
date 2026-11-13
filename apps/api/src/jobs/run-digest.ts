/** One-off digest run, for cron-style schedulers: `pnpm --filter @koinonia/api digest`. */
import { prisma } from "../db";
import { loadEnv } from "../env";
import { createProviders } from "../providers";
import { runDigest } from "../services/digest";

const env = loadEnv();
const result = await runDigest({ prisma, providers: createProviders(env, env.NODE_ENV === "production" ? undefined : console.log), env });
console.log(`Digest: ${result.sent} sent of ${result.considered} users considered.`);
await prisma.$disconnect();
