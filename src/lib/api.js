import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

const unwrap = (result, context) => {
  if (result.error) {
    const err = new Error(`${context}: ${result.error.message}`);
    err.cause = result.error;
    throw err;
  }
  return result.data;
};

const normalizeCityKey = (value = "") =>
  value
    .toString()
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");

const normalizeTextKey = (value = "") =>
  value
    .toString()
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isActiveLoadStatus = (status) => {
  const key = normalizeTextKey(status);
  if (!key) return true;
  return !["completed", "cancelled", "canceled", "closed", "archived"].includes(key);
};

const isDriverRole = (role) => {
  const key = normalizeTextKey(role).replace(/[^a-z0-9]/g, "");
  return ["driver", "sofor", "surucu"].includes(key);
};

const fetchJsonWithTimeout = async ({ url, headers, timeoutMs }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const message =
        (parsed && typeof parsed === "object" && (parsed.message || parsed.error_description || parsed.error)) ||
        text ||
        `HTTP ${res.status}`;
      throw new Error(message);
    }
    return parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const fetchProfileById = async (userId) => {
  const res = await supabase.from("profiles").select("*").eq("id", userId).single();
  return unwrap(res, "Failed to fetch profile");
};

export const fetchNotificationsApi = async (userId) => {
  const res = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return unwrap(res, "Failed to fetch notifications");
};

export const markNotificationReadApi = async (notificationId) => {
  const res = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select("id, is_read")
    .single();
  return unwrap(res, "Failed to mark notification as read");
};

export const fetchBidsForLoadApi = async (loadId) => {
  const res = await supabase
    .from("bids")
    .select(
      `
        *,
        driver:driver_id (
          full_name,
          avatar_url,
          rating
        )
      `
    )
    .eq("load_id", loadId)
    .order("created_at", { ascending: false });
  return unwrap(res, "Failed to fetch bids");
};

export const fetchLoadDetailsApi = async (loadId) => {
  const res = await supabase
    .from("loads")
    .select("*, profiles:employer_id(*)")
    .eq("id", loadId)
    .single();
  return unwrap(res, "Failed to fetch load details");
};

export const fetchMyBidForLoadApi = async (loadId, userId) => {
  const res = await supabase
    .from("bids")
    .select("*")
    .eq("load_id", loadId)
    .eq("driver_id", userId)
    .maybeSingle();
  if (res.error) {
    const err = new Error(`Failed to fetch my bid: ${res.error.message}`);
    err.cause = res.error;
    throw err;
  }
  return res.data;
};

export const createBidApi = async ({ loadId, driverId, price }) => {
  const res = await supabase
    .from("bids")
    .insert([
      {
        load_id: loadId,
        driver_id: driverId,
        price,
        status: "PENDING",
      },
    ])
    .select()
    .single();
  return unwrap(res, "Failed to submit bid");
};

export const updateBidStatusApi = async ({ bidId, status }) => {
  const res = await supabase
    .from("bids")
    .update({ status })
    .eq("id", bidId)
    .select("id, status")
    .single();
  return unwrap(res, "Failed to update bid");
};

export const createNotificationApi = async ({ userId, actorId, message }) => {
  const res = await supabase
    .from("notifications")
    .insert([
      {
        user_id: userId,
        actor_id: actorId,
        message,
        is_read: false,
      },
    ])
    .select("id")
    .single();
  return unwrap(res, "Failed to create notification");
};

export const fetchLoadsApi = async ({ filterFrom, filterTo, filterTrailer }) => {
  let query = supabase
    .from("loads")
    .select("*, profiles:employer_id(*)")
    .order("created_at", { ascending: false });

  // Trailer tipi net bir enum oldugu icin DB tarafinda filtrelenebilir.
  if (filterTrailer) query = query.eq("trailer_type", filterTrailer);

  const res = await query;
  const data = unwrap(res, "Failed to fetch loads");

  const fromKey = normalizeCityKey(filterFrom);
  const toKey = normalizeCityKey(filterTo);

  if (!fromKey && !toKey) return data;

  // Sehir adlarinda olasi karakter/case farklari nedeniyle istemci tarafinda normalize filtre.
  return data.filter((load) => {
    const originKey = normalizeCityKey(load.origin_city);
    const destinationKey = normalizeCityKey(load.destination_city);
    if (fromKey && originKey !== fromKey) return false;
    if (toKey && destinationKey !== toKey) return false;
    return true;
  });
};

export const createLoadApi = async (loadData) => {
  const first = await supabase.from("loads").insert([loadData]).select("id").single();
  if (!first.error) {
    return first.data;
  }

  const message = (first.error?.message || "").toLowerCase();
  const fallbackData = { ...loadData };
  let changed = false;

  // Backward compatibility for older schemas.
  ["kdv_included", "status", "currency"].forEach((field) => {
    if (message.includes(field)) {
      delete fallbackData[field];
      changed = true;
    }
  });

  if (changed) {
    const retry = await supabase.from("loads").insert([fallbackData]).select("id").single();
    return unwrap(retry, "Failed to create load");
  }

  return unwrap(first, "Failed to create load");
};

const postLoadViaRest = async ({ payload, accessToken, timeoutMs }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/loads`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      const message =
        (parsed && typeof parsed === "object" && (parsed.message || parsed.error_description || parsed.error)) ||
        text ||
        `HTTP ${res.status}`;
      const err = new Error(`REST insert failed: ${message}`);
      err.status = res.status;
      throw err;
    }

    if (Array.isArray(parsed) && parsed[0]?.id) {
      return { id: parsed[0].id };
    }
    if (parsed?.id) {
      return { id: parsed.id };
    }
    return parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`REST insert timeout after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const createLoadViaRestApi = async ({ loadData, accessToken, timeoutMs = 20000 }) => {
  if (!accessToken) {
    throw new Error("REST insert requires a valid access token.");
  }

  try {
    return await postLoadViaRest({ payload: loadData, accessToken, timeoutMs });
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const fallbackData = { ...loadData };
    let changed = false;

    ["kdv_included", "status", "currency"].forEach((field) => {
      if (message.includes(field)) {
        delete fallbackData[field];
        changed = true;
      }
    });

    if (changed) {
      return await postLoadViaRest({ payload: fallbackData, accessToken, timeoutMs });
    }

    throw error;
  }
};

export const fetchPublicStatsApi = async () => {
  const [loadsRes, driversRes] = await Promise.all([
    supabase.from("loads").select("id, status, origin_city, destination_city"),
    supabase.from("profiles").select("id, role"),
  ]);

  const loads = unwrap(loadsRes, "Failed to fetch public load stats");
  const activeLoads = loads.filter((row) => isActiveLoadStatus(row.status));

  const citySet = new Set();
  activeLoads.forEach((row) => {
    if (row.origin_city) citySet.add(String(row.origin_city).trim());
    if (row.destination_city) citySet.add(String(row.destination_city).trim());
  });

  let activeDrivers = 0;
  if (!driversRes.error && Array.isArray(driversRes.data)) {
    activeDrivers = driversRes.data.filter((row) => isDriverRole(row.role)).length;
  }

  return {
    activeLoads: activeLoads.length,
    activeDrivers,
    activeCities: citySet.size,
  };
};

export const fetchPublicStatsViaRestApi = async ({ timeoutMs = 12000 } = {}) => {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  const [loadRows, profileRows] = await Promise.all([
    fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/loads?select=status,origin_city,destination_city`,
      headers,
      timeoutMs,
    }),
    fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/profiles?select=role`,
      headers,
      timeoutMs,
    }),
  ]);

  const activeLoads = Array.isArray(loadRows) ? loadRows.filter((row) => isActiveLoadStatus(row.status)) : [];
  const citySet = new Set();
  activeLoads.forEach((row) => {
    if (row.origin_city) citySet.add(String(row.origin_city).trim());
    if (row.destination_city) citySet.add(String(row.destination_city).trim());
  });

  const activeDrivers = Array.isArray(profileRows)
    ? profileRows.filter((row) => isDriverRole(row.role)).length
    : 0;

  return {
    activeLoads: activeLoads.length,
    activeDrivers,
    activeCities: citySet.size,
  };
};

export const ensureProfileApi = async ({ userId, email, fullName, phone, role }) => {
  const existing = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existing.error) {
    const err = new Error(`Failed to verify profile: ${existing.error.message}`);
    err.cause = existing.error;
    throw err;
  }

  if (existing.data) {
    return existing.data;
  }

  const fallbackEmail = String(email || `${userId}@yukcep.local`).trim();
  const roleKey = isDriverRole(role) ? "driver" : "employer";
  const payload = {
    id: userId,
    email: fallbackEmail,
    full_name: String(fullName || "YukCep Kullanici").trim(),
    phone: phone ? String(phone).trim() : null,
    role: roleKey,
  };

  const created = await supabase.from("profiles").insert([payload]).select("*").single();
  return unwrap(created, "Failed to create missing profile");
};
