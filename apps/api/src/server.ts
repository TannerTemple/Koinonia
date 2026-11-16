import { buildApp } from "./app";
import { prisma } from "./db";
import { EnvError, loadEnv, productionWarnings, type Env } from "./env";
import { safeError } from "./lib/log";
import { createProviders } from "./providers";
import { runDigest } from "./services/digest";

let env: Env;
try {
  env = loadEnv();
} catch (err) {
  // A plain message and no stack trace: this is what shows in the host's deploy log.
  console.error(err instanceof EnvError ? `\n${err.message}\n` : err);
  process.exit(1);
}
const providers = createProviders(env, env.NODE_ENV === "production" ? undefined : (line) => console.log(line));
const app = await buildApp({ prisma, providers, env, logger: true });

for (const warning of productionWarnings(env)) app.log.warn(warning);

if (env.DIGEST_ENABLED) {
  const tick = () =>
    runDigest({ prisma, providers, env })
      .then((r) => r.sent && app.log.info(`digest: sent ${r.sent}`))
      .catch((err) => app.log.error({ err: safeError(err) }, "digest failed"));
  setInterval(tick, 15 * 60_000).unref();
  void tick();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  console.error(`\nKoinonia API cannot start: port ${env.PORT} could not be opened (${safeError(err).message ?? "unknown error"}). Is another copy already running?\n`);
  process.exit(1);
}
if (env.NODE_ENV === "production") {
  app.log.info(`ready: web app ${env.WEB_URL}; browsers allowed from ${env.CORS_ORIGINS}; public address ${env.API_PUBLIC_URL ?? "(from each request)"}; email ${env.EMAIL_PROVIDER}`);
}
