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

  const message = first.error?.message || "";
  if (message.includes("kdv_included")) {
    const fallbackData = { ...loadData };
    delete fallbackData.kdv_included;
    const retry = await supabase.from("loads").insert([fallbackData]).select("id").single();
    return unwrap(retry, "Failed to create load");
  }

  return unwrap(first, "Failed to create load");
};

export const fetchPublicStatsApi = async () => {
  const [loadsRes, driversRes, cityRowsRes] = await Promise.all([
    supabase.from("loads").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "driver"),
    supabase.from("loads").select("origin_city, destination_city").eq("status", "open"),
  ]);

  if (loadsRes.error) {
    const err = new Error(`Failed to fetch active load count: ${loadsRes.error.message}`);
    err.cause = loadsRes.error;
    throw err;
  }

  if (driversRes.error) {
    const err = new Error(`Failed to fetch driver count: ${driversRes.error.message}`);
    err.cause = driversRes.error;
    throw err;
  }

  const cityRows = unwrap(cityRowsRes, "Failed to fetch city stats");
  const citySet = new Set();
  cityRows.forEach((row) => {
    if (row.origin_city) citySet.add(String(row.origin_city).trim());
    if (row.destination_city) citySet.add(String(row.destination_city).trim());
  });

  return {
    activeLoads: loadsRes.count ?? 0,
    activeDrivers: driversRes.count ?? 0,
    activeCities: citySet.size,
  };
};
