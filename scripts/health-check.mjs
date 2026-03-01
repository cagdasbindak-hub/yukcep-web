import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.YUKCEP_BASE_URL || "https://yukcep.vercel.app/";
const timeoutMs = Number(process.env.YUKCEP_HEALTH_TIMEOUT_MS || "12000");

const run = async () => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let ok = false;
  let status = 0;
  let message = "unknown";

  try {
    const res = await fetch(BASE_URL, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent": "yukcep-health-check/1.0",
      },
    });
    status = res.status;
    const body = await res.text();
    ok = res.ok && /Y\u00fckCep/i.test(body);
    message = ok ? "Homepage responded with expected app marker." : "Response missing expected app marker.";
  } catch (error) {
    message = error?.name === "AbortError" ? `Timeout after ${timeoutMs}ms.` : String(error?.message || error);
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = {
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    ok,
    status,
    durationMs: Date.now() - startedAt,
    message,
  };

  const outDir = path.join(process.cwd(), "tmp", "health");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `health-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf-8");

  console.log(JSON.stringify(payload));
  if (!ok) process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
