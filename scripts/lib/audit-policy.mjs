const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

export function evaluateAudit(report, policy, today = new Date()) {
  if (report.error) {
    return {
      accepted: [],
      failures: [{ package: "npm-audit", reason: "audit request failed" }],
    };
  }
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.exceptions)) {
    return {
      accepted: [],
      failures: [{ package: "audit-policy", reason: "invalid policy schema" }],
    };
  }

  const accepted = [];
  const failures = [];
  const todayValue = today.toISOString().slice(0, 10);
  for (const [packageName, vulnerability] of Object.entries(
    report.vulnerabilities ?? {},
  )) {
    if ((severityRank[vulnerability.severity] ?? 99) < severityRank.high)
      continue;
    const exception = policy.exceptions.find(
      (candidate) =>
        candidate.package === packageName &&
        candidate.severity === vulnerability.severity &&
        JSON.stringify([...candidate.nodes].sort()) ===
          JSON.stringify([...vulnerability.nodes].sort()),
    );
    if (!exception) {
      failures.push({ package: packageName, reason: "no exact exception" });
      continue;
    }
    if (!validDate(exception.expiresOn) || exception.expiresOn < todayValue) {
      failures.push({ package: packageName, reason: "exception expired" });
      continue;
    }
    accepted.push({
      package: packageName,
      severity: vulnerability.severity,
      expiresOn: exception.expiresOn,
      owner: exception.owner,
    });
  }
  return { accepted, failures };
}
