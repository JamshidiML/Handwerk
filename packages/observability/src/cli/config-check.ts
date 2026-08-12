import { ConfigValidationError, loadRuntimeConfig } from "../config";

try {
  const config = loadRuntimeConfig();
  console.log(
    `[config] valid ${config.environment} configuration; demo=${String(config.demoMode)}; telemetry=${config.telemetryMode}; ai=${config.aiProvider}`,
  );
} catch (error) {
  if (error instanceof ConfigValidationError) {
    for (const issue of error.issues) {
      console.error(`[config] ${issue.variable}: ${issue.reason}`);
    }
    process.exit(1);
  }
  throw error;
}
