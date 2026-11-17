import { describe, expect, it } from "vitest";
import { EnvError, loadEnv } from "../src/env";

const pooled = "postgresql://u:secret@ep-cool-1-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
const direct = "postgresql://u:secret@ep-cool-1.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = { NODE_ENV: "production", DATABASE_URL: pooled, DIRECT_URL: direct, WEB_URL: "https://koinonia.vercel.app" };

const message = (env: Record<string, string>) => {
  try {
    loadEnv(env);
  } catch (err) {
    expect(err).toBeInstanceOf(EnvError);
    return (err as Error).message;
  }
  return "";
};

describe("settings checked at startup", () => {
  it("accepts the three values the deploy guide asks for, and fills in the rest", () => {
    const env = loadEnv({ ...prod, RENDER_EXTERNAL_URL: "https://koinonia-api.onrender.com" });
    expect(env.CORS_ORIGINS).toBe("https://koinonia.vercel.app");
    expect(env.API_PUBLIC_URL).toBe("https://koinonia-api.onrender.com");
    expect(env.EMAIL_PROVIDER).toBe("mock");
  });

  it("forgives quotes, spaces, trailing slashes and empty boxes", () => {
    const env = loadEnv({ ...prod, DATABASE_URL: ` "${pooled}" `, WEB_URL: " https://koinonia.vercel.app/ ", CORS_ORIGINS: "https://a.example.com/, https://b.example.com", API_PUBLIC_URL: "", SENTRY_DSN: " " });
    expect(env.DATABASE_URL).toBe(pooled);
    expect(env.WEB_URL).toBe("https://koinonia.vercel.app");
    expect(env.CORS_ORIGINS).toBe("https://a.example.com,https://b.example.com");
    expect(env.API_PUBLIC_URL).toBeUndefined();
  });

  it("names the missing database address in plain words", () => {
    const text = message({ NODE_ENV: "production" });
    expect(text).toContain("Koinonia API cannot start: one setting is missing or wrong.");
    expect(text).toContain("DATABASE_URL is missing. Paste the connection string from Neon");
    expect(text).toContain("Render");
  });

  it("explains each way a Neon address goes wrong", () => {
    expect(message({ ...prod, DATABASE_URL: `psql '${pooled}'` })).toContain('DATABASE_URL starts with "psql"');
    expect(message({ ...prod, DATABASE_URL: "ep-cool-1.neon.tech" })).toContain("DATABASE_URL must start with postgresql://");
    expect(message({ ...prod, DATABASE_URL: "postgresql://u:[YOUR-PASSWORD]@ep-cool-1.neon.tech/neondb" })).toContain("placeholder");
    expect(message({ ...prod, DIRECT_URL: pooled })).toContain("DIRECT_URL is the pooled address");
    expect(message({ NODE_ENV: "production", DATABASE_URL: pooled })).toContain("DIRECT_URL is missing. DATABASE_URL is Neon's pooled address");
  });

  it("never prints a password", () => {
    const text = message({ ...prod, DATABASE_URL: `psql '${pooled}'`, DIRECT_URL: pooled, WEB_URL: "koinonia.vercel.app" });
    expect(text).not.toContain("secret");
    expect(text).toContain("3 settings are missing or wrong");
    expect(text).toContain('WEB_URL must be the web app\'s address, like https://app.example.com. It is "koinonia.vercel.app".');
  });

  it("lists every wrong setting at once", () => {
    const text = message({ ...prod, CORS_ORIGINS: "*", LOG_LEVEL: "loud", EMAIL_PROVIDER: "resend" });
    for (const name of ["CORS_ORIGINS", "LOG_LEVEL", "RESEND_API_KEY", "EMAIL_FROM"]) expect(text).toContain(`- ${name} `);
  });
});
