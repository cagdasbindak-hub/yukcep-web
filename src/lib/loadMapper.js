const hashString = (value) => {
  let hash = 0;
  const str = String(value ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const stableRange = (seed, min, max) => {
  const h = hashString(seed);
  const normalized = h / 0xffffffff;
  return min + normalized * (max - min);
};

const getStableMapPoint = (dbLoad) => {
  const seedBase = `${dbLoad.id}-${dbLoad.origin_city}-${dbLoad.destination_city}`;
  return {
    x: Number(stableRange(`${seedBase}:x`, 10, 90).toFixed(2)),
    y: Number(stableRange(`${seedBase}:y`, 10, 70).toFixed(2)),
  };
};

export const mapDbToUi = (dbLoad) => {
  const point = getStableMapPoint(dbLoad);
  return {
    id: dbLoad.id,
    from: dbLoad.origin_city,
    to: dbLoad.destination_city,
    price: dbLoad.price,
    type: dbLoad.load_type,
    trailer: dbLoad.trailer_type,
    distance: dbLoad.distance_km ? `${dbLoad.distance_km} km` : "N/A",
    weight: dbLoad.weight_kg ? `${dbLoad.weight_kg / 1000} ton` : "N/A",
    urgent: Boolean(dbLoad.is_urgent),
    daysOld: Math.max(
      0,
      Math.floor((Date.now() - new Date(dbLoad.created_at).getTime()) / (1000 * 60 * 60 * 24))
    ),
    employer: dbLoad.profiles?.full_name || "İşveren",
    employerAvatar: dbLoad.profiles?.avatar_url || null,
    kdv: dbLoad.kdv_included ?? true,
    fleet: Boolean(dbLoad.is_fleet),
    x: point.x,
    y: point.y,
  };
};
