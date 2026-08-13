import { createConnection } from "node:net";
import { loadRuntimeConfig } from "../config";
import { HealthService, type HealthCheck } from "../health";

function postgresCheck(databaseUrl: URL): HealthCheck {
  return {
    name: "postgresql",
    check: (signal) =>
      new Promise((resolve) => {
        const socket = createConnection({
          host: databaseUrl.hostname,
          port: Number(databaseUrl.port || "5432"),
        });
        const finish = (status: "up" | "down", reasonCode?: string) => {
          socket.destroy();
          resolve({ status, ...(reasonCode ? { reasonCode } : {}) });
        };
        socket.once("connect", () => finish("up"));
        socket.once("error", () => finish("down", "connection_failed"));
        signal.addEventListener("abort", () => finish("down", "timeout"), {
          once: true,
        });
      }),
  };
}

function objectStorageCheck(endpoint: URL): HealthCheck {
  return {
    name: "object-storage",
    async check(signal) {
      try {
        const ready = new URL("/minio/health/ready", endpoint);
        const response = await fetch(ready, { method: "GET", signal });
        return response.ok
          ? { status: "up" }
          : { status: "down", reasonCode: "unhealthy_response" };
      } catch {
        return { status: "down", reasonCode: "connection_failed" };
      }
    },
  };
}

const config = loadRuntimeConfig();
const health = new HealthService(
  [
    postgresCheck(config.databaseUrl),
    objectStorageCheck(config.objectStorage.endpoint),
  ],
  3_000,
);
const result = await health.readiness();
console.log(
  JSON.stringify({ liveness: health.liveness(), readiness: result }, null, 2),
);
if (result.status !== "ready") process.exit(1);
