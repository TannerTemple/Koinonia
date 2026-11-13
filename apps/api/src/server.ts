import { buildApp } from "./app";
import { prisma } from "./db";
import { loadEnv } from "./env";
import { createProviders } from "./providers";
import { runDigest } from "./services/digest";

const env = loadEnv();
const providers = createProviders(env, env.NODE_ENV === "production" ? undefined : (line) => console.log(line));
const app = await buildApp({ prisma, providers, env, logger: true });

if (env.NODE_ENV === "production" && env.EMAIL_PROVIDER === "mock") {
  app.log.warn("EMAIL_PROVIDER=mock: no email is being sent. Password reset and email confirmation will not reach anyone. See docs/DEPLOY.md, step 5.");
}

if (env.DIGEST_ENABLED) {
  const tick = () =>
    runDigest({ prisma, providers, env })
      .then((r) => r.sent && app.log.info(`digest: sent ${r.sent}`))
      .catch((err) => app.log.error(err, "digest failed"));
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

await app.listen({ port: env.PORT, host: env.HOST });
