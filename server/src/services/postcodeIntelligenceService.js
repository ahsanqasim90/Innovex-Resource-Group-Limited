const METRES_PER_MILE = 1609.344;

export function outwardCode(value = "") {
  const compact = String(value || "").toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return compact.slice(0, -3);
  return compact.match(/^[A-Z]{1,2}\d[A-Z\d]?$/)?.[0] || "";
}

export function haversineMiles(aLat, aLng, bLat, bLng) {
  const values = [aLat, aLng, bLat, bLng].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const [lat1, lon1, lat2, lon2] = values;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const formula = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(formula), Math.sqrt(1 - formula));
}

export async function vacancyLocationContext(postcode = "", radiusMiles = 25) {
  const cleaned = String(postcode || "").trim();
  const compact = cleaned.toUpperCase().replace(/\s+/g, "");
  const outcode = outwardCode(compact);
  if (!outcode) return { origin: null, outcodeDistances: new Map(), haversineMiles };
  try {
    const isFullPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact);
    const originEndpoint = isFullPostcode ? `postcodes/${encodeURIComponent(compact)}` : `outcodes/${encodeURIComponent(outcode)}`;
    const originResponse = await fetch(`https://api.postcodes.io/${originEndpoint}`, { signal: AbortSignal.timeout(5000) });
    const originData = originResponse.ok ? await originResponse.json() : null;
    const origin = originData?.result ? { postcode: originData.result.postcode || originData.result.outcode || outcode, latitude: Number(originData.result.latitude), longitude: Number(originData.result.longitude) } : null;
    if (!origin) return { origin: null, outcodeDistances: new Map(), haversineMiles };

    const originOutcode = outwardCode(origin.postcode) || outcode;
    const requestedRadius = Math.min(Math.max(Number(radiusMiles || 25), 5), 100);
    const nearbyResponse = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(originOutcode)}/nearest?limit=100&radius=${Math.round(requestedRadius * METRES_PER_MILE * 1.8)}`, { signal: AbortSignal.timeout(5000) });
    const nearbyData = nearbyResponse.ok ? await nearbyResponse.json() : null;
    const outcodeDistances = new Map([[originOutcode, 0]]);
    for (const item of nearbyData?.result || []) {
      const code = outwardCode(item.outcode);
      if (!code) continue;
      const rawDistance = Number(item.distance || 0);
      const miles = rawDistance > 500 ? rawDistance / METRES_PER_MILE : rawDistance;
      outcodeDistances.set(code, Number(miles.toFixed(1)));
    }
    return { origin, outcodeDistances, haversineMiles };
  } catch {
    return { origin: null, outcodeDistances: new Map(), haversineMiles };
  }
}
