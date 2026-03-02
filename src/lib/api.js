import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

const unwrap = (result, context) => {
  if (result.error) {
    const err = new Error(`${context}: ${result.error.message}`);
    err.cause = result.error;
    throw err;
  }
  return result.data;
};

const isMissingColumnError = (errorOrMessage, columnName) => {
  const message = String(
    errorOrMessage?.message ||
      errorOrMessage?.details ||
      errorOrMessage?.hint ||
      errorOrMessage?.error_description ||
      errorOrMessage ||
      ""
  ).toLowerCase();
  const key = String(columnName || "").toLowerCase();
  if (!key) return false;
  return message.includes(key) && (message.includes("does not exist") || message.includes("column"));
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

const getTodayDateKey = () => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const isTodayOrFuturePickupDate = (pickupDate, todayDateKey = getTodayDateKey()) => {
  const key = String(pickupDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return key >= todayDateKey;
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

const buildProfileMap = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    if (row?.id) {
      map.set(row.id, row);
    }
  });
  return map;
};

const mapBidsWithOptionalUpdatedAt = (rows = []) =>
  rows.map((row) => ({
    ...row,
    updated_at: row?.updated_at || row?.created_at || null,
  }));

const buildBidsQueryWithProjection = ({ projection, userId, loadIds }) => {
  let query = supabase.from("bids").select(projection).order("created_at", { ascending: false });
  if (userId) query = query.eq("driver_id", userId);
  if (Array.isArray(loadIds)) {
    if (!loadIds.length) return null;
    query = query.in("load_id", loadIds);
  }
  return query;
};

const fetchBidsWithOptionalUpdatedAt = async ({ userId, loadIds, context }) => {
  const withUpdatedAt = buildBidsQueryWithProjection({
    projection: "id, load_id, driver_id, price, status, created_at, updated_at",
    userId,
    loadIds,
  });
  if (!withUpdatedAt) return [];
  const first = await withUpdatedAt;
  if (!first.error) {
    return mapBidsWithOptionalUpdatedAt(first.data || []);
  }

  const message = String(first.error?.message || "").toLowerCase();
  if (message.includes("updated_at")) {
    const fallback = buildBidsQueryWithProjection({
      projection: "id, load_id, driver_id, price, status, created_at",
      userId,
      loadIds,
    });
    if (!fallback) return [];
    const second = await fallback;
    const data = unwrap(second, context);
    return mapBidsWithOptionalUpdatedAt(data || []);
  }

  const err = new Error(`${context}: ${first.error.message}`);
  err.cause = first.error;
  throw err;
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

export const fetchBidsForLoadViaRestApi = async ({ loadId, accessToken, timeoutMs = 12000 }) => {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
  };

  let bidsRows = null;
  try {
    bidsRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/bids?select=id,load_id,driver_id,price,status,created_at,updated_at&load_id=eq.${loadId}&order=created_at.desc`,
      headers,
      timeoutMs,
    });
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("updated_at")) throw error;
    bidsRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/bids?select=id,load_id,driver_id,price,status,created_at&load_id=eq.${loadId}&order=created_at.desc`,
      headers,
      timeoutMs,
    });
  }
  const bids = mapBidsWithOptionalUpdatedAt(Array.isArray(bidsRows) ? bidsRows : []);
  if (!bids.length) return [];

  const driverIds = [...new Set(bids.map((row) => row.driver_id).filter(Boolean))];
  let profileMap = new Map();
  if (driverIds.length) {
    const profileRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,avatar_url,rating,phone,role&id=in.(${driverIds.join(",")})`,
      headers,
      timeoutMs,
    });
    if (Array.isArray(profileRows)) {
      profileMap = buildProfileMap(profileRows);
    }
  }

  return bids.map((bid) => ({
    ...bid,
    driver: profileMap.get(bid.driver_id) || null,
  }));
};

export const fetchLoadDetailsApi = async (loadId) => {
  const loadRes = await supabase
    .from("loads")
    .select("*")
    .eq("id", loadId)
    .single();
  const load = unwrap(loadRes, "Failed to fetch load details");

  let profile = null;
  if (load?.employer_id) {
    const profileRes = await supabase
      .from("profiles")
      .select("*")
      .eq("id", load.employer_id)
      .maybeSingle();
    if (!profileRes.error) {
      profile = profileRes.data || null;
    }
  }

  return {
    ...load,
    profiles: profile,
  };
};

export const fetchLoadDetailsViaRestApi = async ({ loadId, timeoutMs = 12000 }) => {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  const loadRows = await fetchJsonWithTimeout({
    url: `${SUPABASE_URL}/rest/v1/loads?select=*&id=eq.${encodeURIComponent(loadId)}&limit=1`,
    headers,
    timeoutMs,
  });

  const load = Array.isArray(loadRows) ? loadRows[0] : null;
  if (!load) {
    throw new Error("Load not found.");
  }

  let profile = null;
  if (load.employer_id) {
    try {
      const profileRows = await fetchJsonWithTimeout({
        url: `${SUPABASE_URL}/rest/v1/profiles?select=*&id=eq.${load.employer_id}&limit=1`,
        headers,
        timeoutMs,
      });
      profile = Array.isArray(profileRows) ? profileRows[0] || null : null;
    } catch {
      profile = null;
    }
  }

  return {
    ...load,
    profiles: profile,
  };
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
  const payload = {
    load_id: loadId,
    driver_id: driverId,
    price,
    status: "PENDING",
    updated_at: new Date().toISOString(),
  };

  const first = await supabase
    .from("bids")
    .insert([payload])
    .select()
    .single();
  if (!first.error) {
    return first.data;
  }

  const message = String(first.error?.message || "").toLowerCase();
  if (message.includes("updated_at")) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.updated_at;
    const retry = await supabase.from("bids").insert([fallbackPayload]).select().single();
    return unwrap(retry, "Failed to submit bid");
  }

  return unwrap(first, "Failed to submit bid");
};

export const updateBidStatusApi = async ({ bidId, status }) => {
  const payload = {
    status,
    updated_at: new Date().toISOString(),
  };

  const first = await supabase
    .from("bids")
    .update(payload)
    .eq("id", bidId)
    .select("id, status, updated_at")
    .single();
  if (!first.error) {
    return first.data;
  }

  const message = String(first.error?.message || "").toLowerCase();
  if (message.includes("updated_at")) {
    const retry = await supabase
      .from("bids")
      .update({ status })
      .eq("id", bidId)
      .select("id, status")
      .single();
    return unwrap(retry, "Failed to update bid");
  }

  return unwrap(first, "Failed to update bid");
};

export const updateLoadStatusApi = async ({ loadId, status }) => {
  const transitionAttempt = await supabase.rpc("set_load_status_with_transition", {
    p_load_id: loadId,
    p_next_status: status,
  });
  if (!transitionAttempt.error && Array.isArray(transitionAttempt.data) && transitionAttempt.data[0]) {
    return transitionAttempt.data[0];
  }

  const fallback = await supabase
    .from("loads")
    .update({ status })
    .eq("id", loadId)
    .select("id, status")
    .single();
  return unwrap(fallback, "Failed to update load status");
};

const patchViaRestApi = async ({ table, key, value, payload, accessToken, timeoutMs }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${encodeURIComponent(key)}=eq.${encodeURIComponent(value)}`,
      {
        method: "PATCH",
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      }
    );

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

    if (Array.isArray(parsed)) return parsed[0] || null;
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

export const updateBidStatusViaRestApi = async ({ bidId, status, accessToken, timeoutMs = 12000 }) => {
  const payload = {
    status,
    updated_at: new Date().toISOString(),
  };
  try {
    return await patchViaRestApi({
      table: "bids",
      key: "id",
      value: bidId,
      payload,
      accessToken,
      timeoutMs,
    });
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("updated_at")) throw error;
    return patchViaRestApi({
      table: "bids",
      key: "id",
      value: bidId,
      payload: { status },
      accessToken,
      timeoutMs,
    });
  }
};

export const updateLoadStatusViaRestApi = async ({ loadId, status, accessToken, timeoutMs = 12000 }) =>
  patchViaRestApi({
    table: "loads",
    key: "id",
    value: loadId,
    payload: { status },
    accessToken,
    timeoutMs,
  });

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

const postNotificationViaRest = async ({ payload, accessToken, timeoutMs }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
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
      throw new Error(`REST notification insert failed: ${message}`);
    }

    if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    return parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`REST notification insert timeout after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const createNotificationViaRestApi = async ({
  userId,
  actorId,
  message,
  accessToken,
  timeoutMs = 12000,
}) => {
  if (!accessToken) {
    throw new Error("REST notification insert requires a valid access token.");
  }
  return postNotificationViaRest({
    payload: {
      user_id: userId,
      actor_id: actorId,
      message,
      is_read: false,
    },
    accessToken,
    timeoutMs,
  });
};

export const fetchLoadsApi = async ({ filterFrom, filterTo, filterTrailer }) => {
  const selectWithPickupTime =
    "id, employer_id, origin_city, destination_city, distance_km, load_type, trailer_type, weight_kg, price, currency, kdv_included, status, pickup_date, pickup_time, created_at, is_urgent, is_fleet, truck_count";
  const selectWithoutPickupTime =
    "id, employer_id, origin_city, destination_city, distance_km, load_type, trailer_type, weight_kg, price, currency, kdv_included, status, pickup_date, created_at, is_urgent, is_fleet, truck_count";

  const buildLoadsQuery = (projection) => {
    let query = supabase
      .from("loads")
      .select(projection)
      .order("created_at", { ascending: false })
      .limit(300);
    if (filterTrailer) query = query.eq("trailer_type", filterTrailer);
    return query;
  };

  let res = await buildLoadsQuery(selectWithPickupTime);
  if (res.error && isMissingColumnError(res.error, "pickup_time")) {
    res = await buildLoadsQuery(selectWithoutPickupTime);
  }

  const todayDateKey = getTodayDateKey();
  const data = unwrap(res, "Failed to fetch loads").filter(
    (load) => isActiveLoadStatus(load.status) && isTodayOrFuturePickupDate(load.pickup_date, todayDateKey)
  );
  const employerIds = [...new Set(data.map((row) => row?.employer_id).filter(Boolean))];
  let profileMap = new Map();
  if (employerIds.length) {
    const profileRes = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, phone, role")
      .in("id", employerIds);
    if (!profileRes.error && Array.isArray(profileRes.data)) {
      profileMap = buildProfileMap(profileRes.data);
    }
  }

  const fromKey = normalizeCityKey(filterFrom);
  const toKey = normalizeCityKey(filterTo);

  if (!fromKey && !toKey) {
    return data.map((load) => ({
      ...load,
      profiles: profileMap.get(load.employer_id) || null,
    }));
  }

  // Sehir adlarinda olasi karakter/case farklari nedeniyle istemci tarafinda normalize filtre.
  return data
    .filter((load) => {
      const originKey = normalizeCityKey(load.origin_city);
      const destinationKey = normalizeCityKey(load.destination_city);
      if (fromKey && originKey !== fromKey) return false;
      if (toKey && destinationKey !== toKey) return false;
      return true;
    })
    .map((load) => ({
      ...load,
      profiles: profileMap.get(load.employer_id) || null,
    }));
};

export const fetchLoadsViaRestApi = async ({
  filterFrom,
  filterTo,
  filterTrailer,
  timeoutMs = 12000,
} = {}) => {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  const buildLoadQuery = (includePickupTime) => {
    const query = new URLSearchParams();
    query.set(
      "select",
      includePickupTime
        ? "id,employer_id,origin_city,destination_city,distance_km,load_type,trailer_type,weight_kg,price,currency,kdv_included,status,pickup_date,pickup_time,created_at,is_urgent,is_fleet,truck_count"
        : "id,employer_id,origin_city,destination_city,distance_km,load_type,trailer_type,weight_kg,price,currency,kdv_included,status,pickup_date,created_at,is_urgent,is_fleet,truck_count"
    );
    query.set("order", "created_at.desc");
    query.set("limit", "300");
    if (filterTrailer) query.set("trailer_type", `eq.${filterTrailer}`);
    return `${SUPABASE_URL}/rest/v1/loads?${query.toString()}`;
  };

  let loadRows = null;
  try {
    loadRows = await fetchJsonWithTimeout({
      url: buildLoadQuery(true),
      headers,
      timeoutMs,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "pickup_time")) throw error;
    loadRows = await fetchJsonWithTimeout({
      url: buildLoadQuery(false),
      headers,
      timeoutMs,
    });
  }

  const todayDateKey = getTodayDateKey();
  const activeLoads = Array.isArray(loadRows)
    ? loadRows.filter(
        (row) => isActiveLoadStatus(row.status) && isTodayOrFuturePickupDate(row.pickup_date, todayDateKey)
      )
    : [];
  const employerIds = [...new Set(activeLoads.map((row) => row?.employer_id).filter(Boolean))];

  let profileMap = new Map();
  if (employerIds.length) {
    try {
      const profileRows = await fetchJsonWithTimeout({
        url: `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,avatar_url,phone,role&id=in.(${employerIds.join(",")})`,
        headers,
        timeoutMs,
      });
      profileMap = buildProfileMap(Array.isArray(profileRows) ? profileRows : []);
    } catch {
      // Profiles join is best-effort on fallback path.
    }
  }

  const fromKey = normalizeCityKey(filterFrom);
  const toKey = normalizeCityKey(filterTo);

  return activeLoads
    .filter((load) => {
      const originKey = normalizeCityKey(load.origin_city);
      const destinationKey = normalizeCityKey(load.destination_city);
      if (fromKey && originKey !== fromKey) return false;
      if (toKey && destinationKey !== toKey) return false;
      return true;
    })
    .map((load) => ({
      ...load,
      profiles: profileMap.get(load.employer_id) || null,
    }));
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
  ["kdv_included", "status", "currency", "pickup_time"].forEach((field) => {
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

    ["kdv_included", "status", "currency", "pickup_time"].forEach((field) => {
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

export const updateLoadApi = async ({ loadId, employerId, updates }) => {
  const first = await supabase
    .from("loads")
    .update(updates)
    .eq("id", loadId)
    .eq("employer_id", employerId)
    .select(
      "id, employer_id, origin_city, destination_city, distance_km, load_type, trailer_type, weight_kg, price, currency, kdv_included, status, pickup_date, pickup_time, created_at, is_urgent, is_fleet, truck_count"
    )
    .maybeSingle();

  if (!first.error) return first.data;

  if (isMissingColumnError(first.error, "pickup_time")) {
    const fallbackUpdates = { ...updates };
    delete fallbackUpdates.pickup_time;
    const retry = await supabase
      .from("loads")
      .update(fallbackUpdates)
      .eq("id", loadId)
      .eq("employer_id", employerId)
      .select(
        "id, employer_id, origin_city, destination_city, distance_km, load_type, trailer_type, weight_kg, price, currency, kdv_included, status, pickup_date, created_at, is_urgent, is_fleet, truck_count"
      )
      .maybeSingle();
    return unwrap(retry, "Failed to update load");
  }

  return unwrap(first, "Failed to update load");
};

const patchLoadViaRest = async ({
  loadId,
  employerId,
  payload,
  accessToken,
  timeoutMs,
  includePickupTime = true,
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const select = includePickupTime
      ? "id,employer_id,origin_city,destination_city,distance_km,load_type,trailer_type,weight_kg,price,currency,kdv_included,status,pickup_date,pickup_time,created_at,is_urgent,is_fleet,truck_count"
      : "id,employer_id,origin_city,destination_city,distance_km,load_type,trailer_type,weight_kg,price,currency,kdv_included,status,pickup_date,created_at,is_urgent,is_fleet,truck_count";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/loads?id=eq.${encodeURIComponent(loadId)}&employer_id=eq.${encodeURIComponent(
        employerId
      )}&select=${select}`,
      {
        method: "PATCH",
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      }
    );
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
      throw new Error(`REST load update failed: ${message}`);
    }
    if (Array.isArray(parsed)) return parsed[0] || null;
    return parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`REST load update timeout after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const updateLoadViaRestApi = async ({
  loadId,
  employerId,
  updates,
  accessToken,
  timeoutMs = 16000,
}) => {
  if (!accessToken) {
    throw new Error("REST load update requires a valid access token.");
  }
  try {
    return await patchLoadViaRest({
      loadId,
      employerId,
      payload: updates,
      accessToken,
      timeoutMs,
      includePickupTime: true,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "pickup_time")) throw error;
    const fallbackPayload = { ...updates };
    delete fallbackPayload.pickup_time;
    return patchLoadViaRest({
      loadId,
      employerId,
      payload: fallbackPayload,
      accessToken,
      timeoutMs,
      includePickupTime: false,
    });
  }
};

export const deleteLoadApi = async ({ loadId, employerId }) => {
  const res = await supabase
    .from("loads")
    .delete()
    .eq("id", loadId)
    .eq("employer_id", employerId)
    .select("id")
    .maybeSingle();
  return unwrap(res, "Failed to delete load");
};

export const deleteLoadViaRestApi = async ({
  loadId,
  employerId,
  accessToken,
  timeoutMs = 16000,
}) => {
  if (!accessToken) {
    throw new Error("REST load delete requires a valid access token.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/loads?id=eq.${encodeURIComponent(loadId)}&employer_id=eq.${encodeURIComponent(
        employerId
      )}`,
      {
        method: "DELETE",
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "return=representation",
        },
      }
    );
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
      throw new Error(`REST load delete failed: ${message}`);
    }
    if (Array.isArray(parsed)) return parsed[0] || null;
    return parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`REST load delete timeout after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const postBidViaRest = async ({ payload, accessToken, timeoutMs }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bids`, {
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
      const err = new Error(`REST bid insert failed: ${message}`);
      err.status = res.status;
      throw err;
    }

    if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    return parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`REST bid insert timeout after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const createBidViaRestApi = async ({ loadId, driverId, price, accessToken, timeoutMs = 15000 }) => {
  if (!accessToken) {
    throw new Error("REST bid insert requires a valid access token.");
  }

  const payload = {
    load_id: loadId,
    driver_id: driverId,
    price,
    status: "PENDING",
    updated_at: new Date().toISOString(),
  };

  try {
    return await postBidViaRest({ payload, accessToken, timeoutMs });
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("updated_at")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.updated_at;
      return await postBidViaRest({ payload: fallbackPayload, accessToken, timeoutMs });
    }
    throw error;
  }
};

export const fetchPublicStatsApi = async () => {
  const [loadsRes, driversRes] = await Promise.all([
    supabase.from("loads").select("id, status, pickup_date, origin_city, destination_city"),
    supabase.from("profiles").select("id, role"),
  ]);

  const loads = unwrap(loadsRes, "Failed to fetch public load stats");
  const todayDateKey = getTodayDateKey();
  const activeLoads = loads.filter(
    (row) => isActiveLoadStatus(row.status) && isTodayOrFuturePickupDate(row.pickup_date, todayDateKey)
  );

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
      url: `${SUPABASE_URL}/rest/v1/loads?select=status,pickup_date,origin_city,destination_city`,
      headers,
      timeoutMs,
    }),
    fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/profiles?select=role`,
      headers,
      timeoutMs,
    }),
  ]);

  const todayDateKey = getTodayDateKey();
  const activeLoads = Array.isArray(loadRows)
    ? loadRows.filter(
        (row) => isActiveLoadStatus(row.status) && isTodayOrFuturePickupDate(row.pickup_date, todayDateKey)
      )
    : [];
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

export const fetchDriverFeedApi = async ({ userId }) => {
  const bids = await fetchBidsWithOptionalUpdatedAt({
    userId,
    context: "Failed to fetch driver feed bids",
  });

  if (!bids.length) return [];

  const loadIds = [...new Set(bids.map((row) => row.load_id).filter(Boolean))];
  const selectWithPickupTime =
    "id, employer_id, origin_city, destination_city, pickup_date, pickup_time, load_type, trailer_type, price, currency, status, created_at";
  const selectWithoutPickupTime =
    "id, employer_id, origin_city, destination_city, pickup_date, load_type, trailer_type, price, currency, status, created_at";
  let loadsRes = await supabase
    .from("loads")
    .select(selectWithPickupTime)
    .in("id", loadIds);
  if (loadsRes.error && isMissingColumnError(loadsRes.error, "pickup_time")) {
    loadsRes = await supabase
      .from("loads")
      .select(selectWithoutPickupTime)
      .in("id", loadIds);
  }
  const allLoads = unwrap(loadsRes, "Failed to fetch driver feed loads");
  const todayDateKey = getTodayDateKey();
  const loads = allLoads.filter((row) => isTodayOrFuturePickupDate(row.pickup_date, todayDateKey));
  const loadMap = new Map(loads.map((row) => [row.id, row]));
  const visibleBids = bids.filter((row) => loadMap.has(row.load_id));

  const employerIds = [...new Set(loads.map((row) => row.employer_id).filter(Boolean))];
  let profileMap = new Map();
  if (employerIds.length) {
    const profileRes = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url, role")
      .in("id", employerIds);
    if (!profileRes.error && Array.isArray(profileRes.data)) {
      profileMap = buildProfileMap(profileRes.data);
    }
  }

  return visibleBids.map((bid) => {
    const load = loadMap.get(bid.load_id) || {};
    const employer = profileMap.get(load.employer_id) || null;
    return {
      bid_id: bid.id,
      bid_status: bid.status,
      bid_price: bid.price,
      bid_created_at: bid.created_at,
      bid_updated_at: bid.updated_at,
      load_id: bid.load_id,
      origin_city: load.origin_city || "-",
      destination_city: load.destination_city || "-",
      pickup_date: load.pickup_date || null,
      pickup_time: load.pickup_time || null,
      load_type: load.load_type || "-",
      trailer_type: load.trailer_type || "-",
      load_price: load.price || 0,
      currency: load.currency || "TRY",
      load_status: load.status || "open",
      employer_id: load.employer_id || null,
      employer_name: employer?.full_name || "İşveren",
      employer_phone: employer?.phone || null,
      employer_avatar: employer?.avatar_url || null,
      employer_role: employer?.role || "employer",
      load_created_at: load.created_at || null,
    };
  });
};

export const fetchDriverFeedViaRestApi = async ({ userId, accessToken, timeoutMs = 12000 }) => {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
  };

  let bidRows = [];
  try {
    bidRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/bids?select=id,load_id,driver_id,price,status,created_at,updated_at&driver_id=eq.${encodeURIComponent(
        userId
      )}&order=created_at.desc`,
      headers,
      timeoutMs,
    });
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("updated_at")) throw error;
    bidRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/bids?select=id,load_id,driver_id,price,status,created_at&driver_id=eq.${encodeURIComponent(
        userId
      )}&order=created_at.desc`,
      headers,
      timeoutMs,
    });
  }
  const bids = mapBidsWithOptionalUpdatedAt(Array.isArray(bidRows) ? bidRows : []);
  if (!bids.length) return [];

  const loadIds = [...new Set(bids.map((row) => row.load_id).filter(Boolean))];
  if (!loadIds.length) return [];

  const buildLoadsUrl = (includePickupTime) =>
    `${SUPABASE_URL}/rest/v1/loads?select=${
      includePickupTime
        ? "id,employer_id,origin_city,destination_city,pickup_date,pickup_time,load_type,trailer_type,price,currency,status,created_at"
        : "id,employer_id,origin_city,destination_city,pickup_date,load_type,trailer_type,price,currency,status,created_at"
    }&id=in.(${loadIds.join(",")})`;

  let loadsRows = null;
  try {
    loadsRows = await fetchJsonWithTimeout({
      url: buildLoadsUrl(true),
      headers,
      timeoutMs,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "pickup_time")) throw error;
    loadsRows = await fetchJsonWithTimeout({
      url: buildLoadsUrl(false),
      headers,
      timeoutMs,
    });
  }
  const todayDateKey = getTodayDateKey();
  const loads = Array.isArray(loadsRows)
    ? loadsRows.filter((row) => isTodayOrFuturePickupDate(row.pickup_date, todayDateKey))
    : [];
  const loadMap = new Map(loads.map((row) => [row.id, row]));
  const visibleBids = bids.filter((row) => loadMap.has(row.load_id));

  const employerIds = [...new Set(loads.map((row) => row.employer_id).filter(Boolean))];
  let profileMap = new Map();
  if (employerIds.length) {
    const profileRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,phone,avatar_url,role&id=in.(${employerIds.join(",")})`,
      headers,
      timeoutMs,
    });
    if (Array.isArray(profileRows)) {
      profileMap = buildProfileMap(profileRows);
    }
  }

  return visibleBids.map((bid) => {
    const load = loadMap.get(bid.load_id) || {};
    const employer = profileMap.get(load.employer_id) || null;
    return {
      bid_id: bid.id,
      bid_status: bid.status,
      bid_price: bid.price,
      bid_created_at: bid.created_at,
      bid_updated_at: bid.updated_at || bid.created_at || null,
      load_id: bid.load_id,
      origin_city: load.origin_city || "-",
      destination_city: load.destination_city || "-",
      pickup_date: load.pickup_date || null,
      pickup_time: load.pickup_time || null,
      load_type: load.load_type || "-",
      trailer_type: load.trailer_type || "-",
      load_price: load.price || 0,
      currency: load.currency || "TRY",
      load_status: load.status || "open",
      employer_id: load.employer_id || null,
      employer_name: employer?.full_name || "İşveren",
      employer_phone: employer?.phone || null,
      employer_avatar: employer?.avatar_url || null,
      employer_role: employer?.role || "employer",
      load_created_at: load.created_at || null,
    };
  });
};

export const fetchEmployerFeedApi = async ({ userId }) => {
  const selectWithPickupTime =
    "id, employer_id, origin_city, destination_city, pickup_date, pickup_time, load_type, trailer_type, price, currency, status, created_at";
  const selectWithoutPickupTime =
    "id, employer_id, origin_city, destination_city, pickup_date, load_type, trailer_type, price, currency, status, created_at";
  let loadsRes = await supabase
    .from("loads")
    .select(selectWithPickupTime)
    .eq("employer_id", userId)
    .order("created_at", { ascending: false });
  if (loadsRes.error && isMissingColumnError(loadsRes.error, "pickup_time")) {
    loadsRes = await supabase
      .from("loads")
      .select(selectWithoutPickupTime)
      .eq("employer_id", userId)
      .order("created_at", { ascending: false });
  }
  const todayDateKey = getTodayDateKey();
  const loads = unwrap(loadsRes, "Failed to fetch employer feed loads").filter((row) =>
    isTodayOrFuturePickupDate(row.pickup_date, todayDateKey)
  );

  if (!loads.length) return [];

  const loadIds = loads.map((row) => row.id);
  const bids = await fetchBidsWithOptionalUpdatedAt({
    loadIds,
    context: "Failed to fetch employer feed bids",
  });

  const driverIds = [...new Set(bids.map((row) => row.driver_id).filter(Boolean))];
  let driverMap = new Map();
  if (driverIds.length) {
    const profileRes = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url, role")
      .in("id", driverIds);
    if (!profileRes.error && Array.isArray(profileRes.data)) {
      driverMap = buildProfileMap(profileRes.data);
    }
  }

  const bidsByLoad = bids.reduce((acc, bid) => {
    if (!acc[bid.load_id]) acc[bid.load_id] = [];
    const driver = driverMap.get(bid.driver_id) || null;
    acc[bid.load_id].push({
      bid_id: bid.id,
      driver_id: bid.driver_id,
      driver_name: driver?.full_name || "Şoför",
      driver_phone: driver?.phone || null,
      driver_avatar: driver?.avatar_url || null,
      driver_role: driver?.role || "driver",
      bid_status: bid.status,
      bid_price: bid.price,
      bid_created_at: bid.created_at,
      bid_updated_at: bid.updated_at,
    });
    return acc;
  }, {});

  return loads.map((load) => {
    const loadBids = (bidsByLoad[load.id] || []).sort(
      (a, b) => new Date(b.bid_created_at).getTime() - new Date(a.bid_created_at).getTime()
    );
    const acceptedCount = loadBids.filter((x) => x.bid_status === "ACCEPTED").length;
    const rejectedCount = loadBids.filter((x) => x.bid_status === "REJECTED").length;
    const pendingCount = loadBids.filter((x) => x.bid_status === "PENDING").length;
    const derivedStatus = acceptedCount > 0 ? "assigned" : load.status || "open";
    return {
      load_id: load.id,
      origin_city: load.origin_city,
      destination_city: load.destination_city,
      pickup_date: load.pickup_date,
      pickup_time: load.pickup_time || null,
      load_type: load.load_type,
      trailer_type: load.trailer_type,
      load_price: load.price,
      currency: load.currency || "TRY",
      load_status: derivedStatus,
      load_created_at: load.created_at,
      bids: loadBids,
      bid_count: loadBids.length,
      pending_count: pendingCount,
      accepted_count: acceptedCount,
      rejected_count: rejectedCount,
    };
  });
};

export const fetchEmployerFeedViaRestApi = async ({ userId, accessToken, timeoutMs = 12000 }) => {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
  };

  const buildLoadsUrl = (includePickupTime) =>
    `${SUPABASE_URL}/rest/v1/loads?select=${
      includePickupTime
        ? "id,employer_id,origin_city,destination_city,pickup_date,pickup_time,load_type,trailer_type,price,currency,status,created_at"
        : "id,employer_id,origin_city,destination_city,pickup_date,load_type,trailer_type,price,currency,status,created_at"
    }&employer_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;

  let loadsRows = null;
  try {
    loadsRows = await fetchJsonWithTimeout({
      url: buildLoadsUrl(true),
      headers,
      timeoutMs,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "pickup_time")) throw error;
    loadsRows = await fetchJsonWithTimeout({
      url: buildLoadsUrl(false),
      headers,
      timeoutMs,
    });
  }
  const todayDateKey = getTodayDateKey();
  const loads = Array.isArray(loadsRows)
    ? loadsRows.filter((row) => isTodayOrFuturePickupDate(row.pickup_date, todayDateKey))
    : [];
  if (!loads.length) return [];

  const loadIds = loads.map((row) => row.id).filter(Boolean);
  if (!loadIds.length) return [];

  let bidsRows = [];
  try {
    bidsRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/bids?select=id,load_id,driver_id,price,status,created_at,updated_at&load_id=in.(${loadIds.join(
        ","
      )})&order=created_at.desc`,
      headers,
      timeoutMs,
    });
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("updated_at")) throw error;
    bidsRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/bids?select=id,load_id,driver_id,price,status,created_at&load_id=in.(${loadIds.join(
        ","
      )})&order=created_at.desc`,
      headers,
      timeoutMs,
    });
  }

  const bids = mapBidsWithOptionalUpdatedAt(Array.isArray(bidsRows) ? bidsRows : []);
  const driverIds = [...new Set(bids.map((row) => row.driver_id).filter(Boolean))];
  let driverMap = new Map();
  if (driverIds.length) {
    const driverRows = await fetchJsonWithTimeout({
      url: `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,phone,avatar_url,role&id=in.(${driverIds.join(",")})`,
      headers,
      timeoutMs,
    });
    if (Array.isArray(driverRows)) {
      driverMap = buildProfileMap(driverRows);
    }
  }

  const bidsByLoad = bids.reduce((acc, bid) => {
    if (!acc[bid.load_id]) acc[bid.load_id] = [];
    const driver = driverMap.get(bid.driver_id) || null;
    acc[bid.load_id].push({
      bid_id: bid.id,
      driver_id: bid.driver_id,
      driver_name: driver?.full_name || "Şoför",
      driver_phone: driver?.phone || null,
      driver_avatar: driver?.avatar_url || null,
      driver_role: driver?.role || "driver",
      bid_status: bid.status,
      bid_price: bid.price,
      bid_created_at: bid.created_at,
      bid_updated_at: bid.updated_at || bid.created_at || null,
    });
    return acc;
  }, {});

  return loads.map((load) => {
    const loadBids = (bidsByLoad[load.id] || []).sort(
      (a, b) => new Date(b.bid_created_at).getTime() - new Date(a.bid_created_at).getTime()
    );
    const acceptedCount = loadBids.filter((x) => x.bid_status === "ACCEPTED").length;
    const rejectedCount = loadBids.filter((x) => x.bid_status === "REJECTED").length;
    const pendingCount = loadBids.filter((x) => x.bid_status === "PENDING").length;
    const derivedStatus = acceptedCount > 0 ? "assigned" : load.status || "open";
    return {
      load_id: load.id,
      origin_city: load.origin_city,
      destination_city: load.destination_city,
      pickup_date: load.pickup_date,
      pickup_time: load.pickup_time || null,
      load_type: load.load_type,
      trailer_type: load.trailer_type,
      load_price: load.price,
      currency: load.currency || "TRY",
      load_status: derivedStatus,
      load_created_at: load.created_at,
      bids: loadBids,
      bid_count: loadBids.length,
      pending_count: pendingCount,
      accepted_count: acceptedCount,
      rejected_count: rejectedCount,
    };
  });
};

export const insertRuntimeLogsApi = async ({ logs }) => {
  const payload = Array.isArray(logs) ? logs.filter(Boolean).slice(0, 50) : [];
  if (!payload.length) return [];

  const res = await supabase.from("runtime_logs").insert(payload).select("id");
  return unwrap(res, "Failed to insert runtime logs");
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

export const updateProfileRoleApi = async ({ userId, role }) => {
  const roleKey = isDriverRole(role) ? "driver" : "employer";
  const res = await supabase
    .from("profiles")
    .update({ role: roleKey })
    .eq("id", userId)
    .select("*")
    .single();
  return unwrap(res, "Failed to update profile role");
};

export const createAbuseReportApi = async ({ loadId, reporterId, reason, details }) => {
  const res = await supabase
    .from("abuse_reports")
    .insert([
      {
        load_id: loadId || null,
        reporter_id: reporterId,
        reason: String(reason || "").trim(),
        details: details ? String(details).trim() : null,
      },
    ])
    .select("id, status, created_at")
    .single();
  return unwrap(res, "Failed to create abuse report");
};

export const fetchFeedbackItemsApi = async ({ limit = 40 } = {}) => {
  const safeLimit = Math.max(5, Math.min(100, Number(limit) || 40));
  const res = await supabase
    .from("feedback_items")
    .select("id, user_id, author_name, content, codex_comment, status_tag, moderation_status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  return unwrap(res, "Failed to fetch feedback items");
};

export const fetchFeedbackItemsViaRestApi = async ({
  limit = 40,
  accessToken,
  timeoutMs = 12000,
} = {}) => {
  const safeLimit = Math.max(5, Math.min(100, Number(limit) || 40));
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
  };

  const rows = await fetchJsonWithTimeout({
    url: `${SUPABASE_URL}/rest/v1/feedback_items?select=id,user_id,author_name,content,codex_comment,status_tag,moderation_status,created_at,updated_at&order=created_at.desc&limit=${safeLimit}`,
    headers,
    timeoutMs,
  });

  return Array.isArray(rows) ? rows : [];
};

export const createFeedbackItemApi = async ({
  userId,
  authorName,
  content,
  codexComment,
  statusTag,
  moderationStatus,
}) => {
  const res = await supabase
    .from("feedback_items")
    .insert([
      {
        user_id: userId,
        author_name: String(authorName || "Kullanıcı").trim(),
        content: String(content || "").trim(),
        codex_comment: String(codexComment || "").trim(),
        status_tag: String(statusTag || "yapilacak"),
        moderation_status: String(moderationStatus || "published"),
      },
    ])
    .select("id, user_id, author_name, content, codex_comment, status_tag, moderation_status, created_at, updated_at")
    .single();
  return unwrap(res, "Failed to create feedback item");
};

export const createFeedbackItemViaRestApi = async ({
  userId,
  authorName,
  content,
  codexComment,
  statusTag,
  moderationStatus,
  accessToken,
  timeoutMs = 12000,
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback_items`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        author_name: String(authorName || "Kullanıcı").trim(),
        content: String(content || "").trim(),
        codex_comment: String(codexComment || "").trim(),
        status_tag: String(statusTag || "yapilacak"),
        moderation_status: String(moderationStatus || "published"),
      }),
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
      throw new Error(`Failed to create feedback item: ${message}`);
    }

    if (Array.isArray(parsed)) return parsed[0] || null;
    return parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Failed to create feedback item: Request timeout after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
