export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const RWANDA_ZONES: Array<{ name: string; lat: number; lon: number }> = [
  { name: "Kimihurura", lat: -1.9536, lon: 30.0905 },
  { name: "Kiyovu", lat: -1.9498, lon: 30.0619 },
  { name: "Kacyiru", lat: -1.9437, lon: 30.0888 },
  { name: "Gishushu", lat: -1.9571, lon: 30.1045 },
  { name: "Remera", lat: -1.9578, lon: 30.1194 },
  { name: "Gikondo", lat: -1.9767, lon: 30.0736 },
  { name: "Nyarugenge", lat: -1.9441, lon: 30.0619 },
  { name: "UR Huye Campus", lat: -2.6105, lon: 29.7401 },
  { name: "Rubavu Beach", lat: -1.6771, lon: 29.2602 },
  { name: "Musanze", lat: -1.4998, lon: 29.6349 },
];

export function resolveRwandaNeighborhood(lat: number, lon: number): string {
  let closest = "Kigali";
  let minKm = Infinity;
  for (const z of RWANDA_ZONES) {
    const km = haversineKm(lat, lon, z.lat, z.lon);
    if (km < minKm) {
      minKm = km;
      closest = z.name;
    }
  }
  return minKm <= 35 ? closest : "Rwanda";
}
