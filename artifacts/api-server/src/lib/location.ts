import { haversineKm } from "./geo.js";

// Strict Rwanda Geofence Boundaries
export function isWithinRwanda(lat: number, lng: number): boolean {
  return lat >= -2.84 && lat <= -1.04 && lng >= 28.86 && lng <= 30.9;
}

// Supported Rwandan Hubs
export const RWANDA_HUBS = [
  { name: "Kimihurura, Gasabo", lat: -1.9536, lng: 30.0821, radiusKm: 10 },
  { name: "Remera / Kacyiru, Gasabo", lat: -1.9583, lng: 30.1128, radiusKm: 10 },
  { name: "Gikondo / Kicukiro", lat: -1.98, lng: 30.075, radiusKm: 10 },
  { name: "Kiyovu / Nyarugenge", lat: -1.9498, lng: 30.0619, radiusKm: 10 },
  { name: "UR Huye Campus, Huye", lat: -2.6044, lng: 29.7439, radiusKm: 15 },
  { name: "Gisenyi, Rubavu", lat: -1.6965, lng: 29.26, radiusKm: 12 },
  { name: "Musanze, Ruhengeri", lat: -1.4998, lng: 29.635, radiusKm: 12 },
];

export function detectRwandaHub(lat: number, lng: number): string {
  let closest = "Kigali";
  let minKm = Infinity;
  for (const hub of RWANDA_HUBS) {
    const d = haversineKm(lat, lng, hub.lat, hub.lng);
    if (d < minKm) {
      minKm = d;
      closest = hub.name;
    }
  }
  return closest;
}
