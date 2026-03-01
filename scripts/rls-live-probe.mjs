import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const loadEnvFromFile = () => {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim();
    if (!process.env[k]) process.env[k] = value;
  }
};

loadEnvFromFile();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const now = Date.now();
const suffix = `${now}${Math.random().toString(36).slice(2, 7)}`;
const password = `YukCep!Rls${String(now).slice(-6)}Aa`;

const employerCreds = {
  email: `rls.employer.${suffix}@example.com`,
  password,
  role: "employer",
  fullName: `RLS Employer ${suffix.slice(-5)}`,
  phone: `0533${String(now).slice(-7)}`,
};

const driverCreds = {
  email: `rls.driver.${suffix}@example.com`,
  password,
  role: "driver",
  fullName: `RLS Driver ${suffix.slice(-5)}`,
  phone: `0555${String(now).slice(-7)}`,
};

const outsiderCreds = {
  email: `rls.outsider.${suffix}@example.com`,
  password,
  role: "driver",
  fullName: `RLS Outsider ${suffix.slice(-5)}`,
  phone: `0505${String(now).slice(-7)}`,
};

const outDir = path.join(process.cwd(), "tmp", "rls");
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, `rls-probe-${now}.json`);

const mkClient = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

const log = [];
const push = (step, ok, details = "") => {
  const row = {
    at: new Date().toISOString(),
    step,
    ok,
    details: String(details || ""),
  };
  log.push(row);
  const status = ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${step}${details ? ` :: ${details}` : ""}`);
};

const assertPass = async (step, fn) => {
  try {
    await fn();
    push(step, true);
  } catch (error) {
    push(step, false, error?.message || String(error));
    throw error;
  }
};

const assertFail = async (step, fn) => {
  try {
    await fn();
    push(step, false, "Expected failure but operation succeeded.");
    throw new Error(`${step}: expected failure but succeeded`);
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("expected failure but succeeded")) throw error;
    push(step, true, `blocked as expected: ${message.slice(0, 180)}`);
  }
};

const createSession = async (creds) => {
  const client = mkClient();
  const signUpRes = await client.auth.signUp({
    email: creds.email,
    password: creds.password,
    options: {
      data: {
        full_name: creds.fullName,
        phone: creds.phone,
        role: creds.role,
      },
    },
  });
  if (signUpRes.error) throw new Error(`signUp failed (${creds.role}): ${signUpRes.error.message}`);

  const signInRes = await client.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (signInRes.error || !signInRes.data?.user) {
    throw new Error(
      `signIn failed (${creds.role}). Email confirmation may be required. ${signInRes.error?.message || ""}`.trim()
    );
  }
  return {
    client,
    user: signInRes.data.user,
  };
};

const ensureProfile = async ({ client, user, creds }) => {
  const payload = {
    id: user.id,
    email: creds.email,
    full_name: creds.fullName,
    phone: creds.phone,
    role: creds.role,
  };
  const { error } = await client.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`profile upsert failed (${creds.role}): ${error.message}`);
};

const run = async () => {
  const result = {
    checkedAt: new Date().toISOString(),
    ok: false,
    reportPath,
    steps: log,
    ids: {},
  };

  let employer;
  let driver;
  let outsider;
  let loadId;
  let bidId;

  try {
    await assertPass("S1 create employer session", async () => {
      employer = await createSession(employerCreds);
      await ensureProfile({ ...employer, creds: employerCreds });
      result.ids.employerId = employer.user.id;
    });

    await assertPass("S2 create driver session", async () => {
      driver = await createSession(driverCreds);
      await ensureProfile({ ...driver, creds: driverCreds });
      result.ids.driverId = driver.user.id;
    });

    await assertPass("S3 create outsider session", async () => {
      outsider = await createSession(outsiderCreds);
      await ensureProfile({ ...outsider, creds: outsiderCreds });
      result.ids.outsiderId = outsider.user.id;
    });

    await assertPass("S4 employer can create own load", async () => {
      const { data, error } = await employer.client
        .from("loads")
        .insert([
          {
            employer_id: employer.user.id,
            origin_city: "Ankara",
            destination_city: "Istanbul",
            distance_km: 450,
            load_type: `RLS Probe ${suffix}`,
            trailer_type: "Kapalı",
            weight_kg: 12000,
            price: 25000,
            currency: "TRY",
            kdv_included: true,
            status: "open",
            pickup_date: new Date().toISOString().slice(0, 10),
          },
        ])
        .select("id")
        .single();
      if (error || !data?.id) throw new Error(error?.message || "load insert returned empty id");
      loadId = data.id;
      result.ids.loadId = loadId;
    });

    await assertFail("S5 driver cannot update employer load status", async () => {
      const { error } = await driver.client
        .from("loads")
        .update({ status: "assigned" })
        .eq("id", loadId);
      if (error) throw error;
    });

    await assertPass("S6 driver can create bid on open load", async () => {
      const { data, error } = await driver.client
        .from("bids")
        .insert([
          {
            load_id: loadId,
            driver_id: driver.user.id,
            price: 23000,
            status: "PENDING",
          },
        ])
        .select("id")
        .single();
      if (error || !data?.id) throw new Error(error?.message || "bid insert failed");
      bidId = data.id;
      result.ids.bidId = bidId;
    });

    await assertFail("S7 outsider cannot update another driver bid", async () => {
      const { error } = await outsider.client
        .from("bids")
        .update({ status: "REJECTED" })
        .eq("id", bidId);
      if (error) throw error;
    });

    await assertPass("S8 employer can accept bid on own load", async () => {
      const { error } = await employer.client
        .from("bids")
        .update({ status: "ACCEPTED" })
        .eq("id", bidId);
      if (error) throw error;
    });

    await assertPass("S9 employer can create notification for driver", async () => {
      const { error } = await employer.client.from("notifications").insert([
        {
          user_id: driver.user.id,
          actor_id: employer.user.id,
          message: `RLS probe notification ${suffix}`,
          is_read: false,
        },
      ]);
      if (error) throw error;
    });

    await assertFail("S10 outsider cannot read driver's notifications", async () => {
      const { data, error } = await outsider.client
        .from("notifications")
        .select("id,message")
        .eq("user_id", driver.user.id)
        .limit(1);
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        throw new Error("outsider unexpectedly received notification rows");
      }
    });

    result.ok = true;
  } catch (error) {
    result.ok = false;
    result.error = error?.message || String(error);
  } finally {
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`[REPORT] ${reportPath}`);
    console.log(JSON.stringify({ ok: result.ok, reportPath }));
    process.exit(result.ok ? 0 : 1);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
