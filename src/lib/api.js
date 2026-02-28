import { supabase } from "./supabase";

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
