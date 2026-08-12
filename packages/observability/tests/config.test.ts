import { describe, expect, it } from "vitest";
import { ConfigValidationError, loadRuntimeConfig } from "../src/config";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    HANDWERK_ENV: "development",
    DEMO_MODE: "true",
    AI_PROVIDER: "deterministic_fake",
    ENABLE_LIVE_AI: "false",
    LOG_LEVEL: "info",
    TELEMETRY_MODE: "local",
    PORT: "3000",
    DATABASE_URL:
      "postgresql://handwerk:local-password@127.0.0.1:5432/handwerk",
    OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:9000",
    OBJECT_STORAGE_REGION: "eu-central-1",
    OBJECT_STORAGE_BUCKET: "handwerk-synthetic",
    OBJECT_STORAGE_ACCESS_KEY: "local-access",
    OBJECT_STORAGE_SECRET_KEY: "local-secret",
  };
}

describe("runtime configuration", () => {
  it("loads the complete local deterministic configuration", () => {
    const config = loadRuntimeConfig(validEnvironment());

    expect(config.environment).toBe("development");
    expect(config.aiProvider).toBe("deterministic_fake");
    expect(config.databaseUrl.protocol).toBe("postgresql:");
    expect(config.objectStorage.endpoint.hostname).toBe("127.0.0.1");
  });

  it("fails closed when demo identity is enabled in production", () => {
    const env = validEnvironment();
    env.HANDWERK_ENV = "production";
    env.OBJECT_STORAGE_ENDPOINT = "https://objects.example.invalid";

    expect(() => loadRuntimeConfig(env)).toThrow(ConfigValidationError);
    try {
      loadRuntimeConfig(env);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect((error as ConfigValidationError).issues).toContainEqual({
        variable: "DEMO_MODE",
        reason: "must be false in production",
      });
    }
  });

  it("never includes a secret value in validation messages", () => {
    const env = validEnvironment();
    env.OBJECT_STORAGE_ENDPOINT = "not a URL with private-material";

    expect(() => loadRuntimeConfig(env)).toThrowError(
      expect.objectContaining({
        message: expect.not.stringContaining("private-material"),
      }),
    );
  });

  it("rejects remote plain-HTTP object storage", () => {
    const env = validEnvironment();
    env.OBJECT_STORAGE_ENDPOINT = "http://objects.example.invalid";

    expect(() => loadRuntimeConfig(env)).toThrow(ConfigValidationError);
  });
});
