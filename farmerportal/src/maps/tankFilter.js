// Which reservoirs and tanks the irrigation map draws (irrigationLayers.js). Plain functions, no Leaflet,
// so they can be unit tested.

// Tank names compared without accents, case, spaces and words like "wewa" / "tank", so the GIS's
// "Hurulu Wewa" is the app's "Huruluwewa".
export const simplifyName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(wewa|tank|reservoir|samudraya|samudra)\b/g, '')
  .replace(/[^a-z0-9]/g, '');

export const nameMatches = (name, selectedNames) => {
  const left = simplifyName(name);
  return Boolean(left && selectedNames.some((selected) => left === simplifyName(selected)));
};

// The tanks we have water level data for, under every spelling the GIS might use.
export const dataTanks = (tanks) => tanks.map((tk) => ({
  names: [tk.name, tk.aka, tk.name.match(/\(([^)]+)\)/)?.[1]].filter(Boolean),
  pos: tk.pos,
}));

// Simplified names to keep: the data tanks' own names plus the GIS names found at their points.
export const dataKeysFor = (tanks, namesAtTheirPoints = []) => new Set(
  [...tanks.flatMap((tk) => tk.names), ...namesAtTheirPoints].map(simplifyName).filter(Boolean),
);

// A tank's outline, point, bund, sluice and spill all carry its Res_Name. Canals and irrigable areas are
// named by scheme, not tank, so they are always kept.
export const TANK_KINDS = new Set(['reservoir', 'tank', 'bund', 'sluice', 'spill']);

// keys: a Set from dataKeysFor, or null to keep everything (the farmer chose "Show all reservoirs").
export function keepDataTanks(kind, geojson, keys) {
  if (!keys || !TANK_KINDS.has(kind)) return geojson;
  return { ...geojson, features: geojson.features.filter((f) => keys.has(simplifyName(f.properties?.Res_Name))) };
}
