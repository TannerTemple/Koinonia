import { loadEnv } from "../env";
import { createProviders } from "../providers";

/**
 * Sends one email through whichever provider the environment selects:
 *   pnpm --filter @koinonia/api email:test you@example.com
 */
const to = process.argv[2];
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error("Usage: pnpm --filter @koinonia/api email:test you@example.com");
  process.exit(1);
}

const env = loadEnv();
const providers = createProviders(env, (line) => console.log(line));
console.log(`Email provider: ${env.EMAIL_PROVIDER} (from ${env.EMAIL_FROM})`);
try {
  await providers.email.send({
    to,
    subject: "Koinonia test email",
    text: "If you are reading this, Koinonia can send email.\n\nNothing else to do.",
  });
  console.log(env.EMAIL_PROVIDER === "mock" ? "Mock provider: nothing was really sent. Set EMAIL_PROVIDER=resend to send for real." : "Accepted by Resend. Check the inbox (and spam).");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
