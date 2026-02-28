import { supabase } from "./supabase";

const unwrap = (result, context) => {
  if (result.error) {
    const err = new Error(`${context}: ${result.error.message}`);
    err.cause = result.error;
    throw err;
  }
  return result.data;
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

  if (filterFrom) query = query.eq("origin_city", filterFrom);
  if (filterTo) query = query.eq("destination_city", filterTo);
  if (filterTrailer) query = query.eq("trailer_type", filterTrailer);

  const res = await query;
  return unwrap(res, "Failed to fetch loads");
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
