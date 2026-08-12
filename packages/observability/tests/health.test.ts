import { describe, expect, it } from "vitest";
import { HealthService, type HealthCheck } from "../src/health";

describe("health and readiness", () => {
  it("reports ready only when every dependency is up", async () => {
    const checks: HealthCheck[] = [
      { name: "postgresql", check: async () => ({ status: "up" }) },
      { name: "object-storage", check: async () => ({ status: "up" }) },
    ];
    const health = new HealthService(checks);

    expect(health.liveness()).toEqual({ status: "alive" });
    expect((await health.readiness()).status).toBe("ready");
  });

  it("uses a safe reason code without leaking exception text", async () => {
    const health = new HealthService([
      {
        name: "postgresql",
        check: async () => {
          throw new Error(
            "postgresql://user:private-password@database.invalid/customer",
          );
        },
      },
    ]);

    const result = await health.readiness();
    expect(result).toMatchObject({
      status: "not_ready",
      checks: [
        { name: "postgresql", status: "down", reasonCode: "check_failed" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private-password");
  });

  it("bounds dependency checks with a timeout", async () => {
    const health = new HealthService(
      [{ name: "object-storage", check: () => new Promise(() => undefined) }],
      10,
    );
    const result = await health.readiness();
    expect(result.checks[0]).toMatchObject({
      status: "down",
      reasonCode: "timeout",
    });
  });
});
