export type Coordinates = {
  longitude: number;
  latitude: number;
};

export type SuggestionMode = "zone" | "point";

export type MapboxSuggestion = {
  name: string;
  name_preferred?: string;
  mapbox_id?: string;
  feature_type: string;
  full_address?: string;
  place_formatted?: string;
  source?: "mapbox" | "french-cities";
  feature?: MapboxFeature;
  context?: {
    country?: { country_code?: string; name?: string };
    region?: { name?: string };
    postcode?: { name?: string };
    place?: { name?: string };
    locality?: { name?: string };
    neighborhood?: { name?: string };
  };
};

export type MapboxFeature = {
  geometry: {
    coordinates: [number, number];
  };
  properties: MapboxSuggestion & {
    bbox?: [number, number, number, number];
    coordinates?: {
      longitude: number;
      latitude: number;
    };
  };
};

type FrenchCommune = {
  code: string;
  nom: string;
  codesPostaux?: string[];
  centre?: {
    coordinates: [number, number];
  };
};

const MAPBOX_SEARCHBOX_URL = "https://api.mapbox.com/search/searchbox/v1";
const FRENCH_CITY_SEARCH_URL = "https://geo.api.gouv.fr/communes";
const FRANCE_BBOX: [number, number, number, number] = [
  -5.6, 41.2, 9.8, 51.3,
];

export function createSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function fallbackBbox(
  center: Coordinates
): [number, number, number, number] {
  const latitudeDelta = 0.18;
  const longitudeDelta =
    latitudeDelta / Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.25);

  return [
    center.longitude - longitudeDelta,
    center.latitude - latitudeDelta,
    center.longitude + longitudeDelta,
    center.latitude + latitudeDelta,
  ];
}

export function expandBbox(
  bbox: [number, number, number, number],
  marginRatio = 0.25
): [number, number, number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngMargin = Math.max((maxLng - minLng) * marginRatio, 0.03);
  const latMargin = Math.max((maxLat - minLat) * marginRatio, 0.03);

  return [
    minLng - lngMargin,
    minLat - latMargin,
    maxLng + lngMargin,
    maxLat + latMargin,
  ];
}

export function isInsideBbox(
  coordinates: Coordinates,
  bbox: [number, number, number, number]
) {
  const [minLng, minLat, maxLng, maxLat] = bbox;

  return (
    coordinates.longitude >= minLng &&
    coordinates.longitude <= maxLng &&
    coordinates.latitude >= minLat &&
    coordinates.latitude <= maxLat
  );
}

export function suggestionLabel(suggestion: MapboxSuggestion) {
  return (
    suggestion.full_address ||
    [suggestion.name_preferred || suggestion.name, suggestion.place_formatted]
      .filter(Boolean)
      .join(", ")
  );
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getSuggestionName(suggestion: MapboxSuggestion) {
  return suggestion.name_preferred || suggestion.name;
}

export function getSuggestionPostcode(suggestion: MapboxSuggestion) {
  const directPostcode = suggestion.context?.postcode?.name;

  if (directPostcode) {
    return directPostcode;
  }

  const searchableText = [
    suggestion.full_address,
    suggestion.place_formatted,
    suggestion.name,
  ]
    .filter(Boolean)
    .join(" ");
  const match = searchableText.match(/\b\d{5}\b/);

  return match?.[0] || "";
}

export function getSuggestionSubtitle(suggestion: MapboxSuggestion) {
  const parts = [
    suggestion.context?.place?.name,
    suggestion.context?.region?.name,
    suggestion.context?.country?.name,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return suggestion.place_formatted || "";
}

export function formatCitySuggestion(suggestion: MapboxSuggestion) {
  const postcode = getSuggestionPostcode(suggestion);

  return `${getSuggestionName(suggestion)}${postcode ? ` (${postcode})` : ""}`;
}

function formatCoordinates(coordinates: Coordinates) {
  return `${coordinates.longitude},${coordinates.latitude}`;
}

function formatBbox(bbox: [number, number, number, number]) {
  return bbox.join(",");
}

function buildSuggestUrl(params: {
  query: string;
  token: string;
  sessionToken: string;
  mode: SuggestionMode;
  proximity: Coordinates | "ip";
  bbox?: [number, number, number, number] | null;
}) {
  const url = new URL(`${MAPBOX_SEARCHBOX_URL}/suggest`);

  url.searchParams.set("q", params.query);
  url.searchParams.set("access_token", params.token);
  url.searchParams.set("session_token", params.sessionToken);
  url.searchParams.set("country", "fr");
  url.searchParams.set("language", "fr");
  url.searchParams.set("limit", "8");
  url.searchParams.set(
    "proximity",
    params.proximity === "ip" ? "ip" : formatCoordinates(params.proximity)
  );

  if (params.mode === "zone") {
    url.searchParams.set("types", "place,locality");
    url.searchParams.set("bbox", formatBbox(FRANCE_BBOX));
  } else {
    url.searchParams.set("types", "poi,address,street,neighborhood");

    if (params.bbox) {
      url.searchParams.set("bbox", formatBbox(params.bbox));
    }
  }

  return url;
}

function buildFrenchCitySearchUrl(query: string) {
  const url = new URL(FRENCH_CITY_SEARCH_URL);

  url.searchParams.set("nom", query);
  url.searchParams.set("fields", "nom,codesPostaux,centre");
  url.searchParams.set("boost", "population");
  url.searchParams.set("limit", "8");

  return url;
}

function communeMatchesQuery(commune: FrenchCommune, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(commune.nom);
  const postcodes = commune.codesPostaux || [];

  return (
    normalizedName.includes(normalizedQuery) ||
    postcodes.some((postcode) => postcode.startsWith(query.trim()))
  );
}

function communeToSuggestion(commune: FrenchCommune): MapboxSuggestion | null {
  if (!commune.centre) {
    return null;
  }

  const [longitude, latitude] = commune.centre.coordinates;
  const postcode = commune.codesPostaux?.[0] || "";

  return {
    name: commune.nom,
    name_preferred: commune.nom,
    mapbox_id: `french-city-${commune.code}`,
    feature_type: "place",
    place_formatted: [postcode, "France"].filter(Boolean).join(", "),
    source: "french-cities",
    context: {
      country: { country_code: "fr", name: "France" },
      postcode: postcode ? { name: postcode } : undefined,
    },
    feature: {
      geometry: { coordinates: [longitude, latitude] },
      properties: {
        name: commune.nom,
        name_preferred: commune.nom,
        mapbox_id: `french-city-${commune.code}`,
        feature_type: "place",
        place_formatted: [postcode, "France"].filter(Boolean).join(", "),
        context: {
          country: { country_code: "fr", name: "France" },
          postcode: postcode ? { name: postcode } : undefined,
        },
      },
    },
  };
}

function rankSuggestions(
  suggestions: MapboxSuggestion[],
  query: string,
  mode: SuggestionMode
) {
  const normalizedQuery = normalizeSearchText(query);
  const typeWeights: Record<string, number> =
    mode === "zone"
      ? { place: 80, locality: 70 }
      : { poi: 55, address: 50, street: 40, neighborhood: 25 };

  return [...suggestions].sort((first, second) => {
    function score(suggestion: MapboxSuggestion) {
      const name = normalizeSearchText(getSuggestionName(suggestion));
      const fullLabel = normalizeSearchText(suggestionLabel(suggestion));
      let value = typeWeights[suggestion.feature_type] || 0;

      if (mode === "zone" && suggestion.source === "french-cities") {
        value += 150;
      }

      if (name === normalizedQuery) {
        value += 120;
      } else if (name.startsWith(normalizedQuery)) {
        value += 90;
      } else if (name.includes(normalizedQuery)) {
        value += 55;
      } else if (fullLabel.includes(normalizedQuery)) {
        value += 25;
      }

      if (suggestion.context?.country?.country_code?.toLowerCase() === "fr") {
        value += 10;
      }

      return value;
    }

    return score(second) - score(first);
  });
}

function dedupeSuggestions(suggestions: MapboxSuggestion[]) {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const key = `${normalizeSearchText(getSuggestionName(suggestion))}-${getSuggestionPostcode(suggestion)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function fetchLocationSuggestions(params: {
  query: string;
  token?: string;
  sessionToken: string;
  mode: SuggestionMode;
  proximity: Coordinates | "ip";
  bbox?: [number, number, number, number] | null;
  signal?: AbortSignal;
}) {
  let suggestions: MapboxSuggestion[] = [];

  if (params.token) {
    const response = await fetch(
      buildSuggestUrl({
        query: params.query,
        token: params.token,
        sessionToken: params.sessionToken,
        mode: params.mode,
        proximity: params.proximity,
        bbox: params.bbox,
      }),
      { signal: params.signal }
    );

    if (!response.ok) {
      throw new Error("La recherche Mapbox a echoue.");
    }

    const data = (await response.json()) as {
      suggestions?: MapboxSuggestion[];
    };

    suggestions =
      params.mode === "zone"
        ? (data.suggestions || []).filter(
            (suggestion) =>
              ["place", "locality"].includes(suggestion.feature_type) &&
              normalizeSearchText(getSuggestionName(suggestion)).includes(
                normalizeSearchText(params.query)
              )
          )
        : data.suggestions || [];
  }

  if (params.mode === "zone") {
    const cityResponse = await fetch(buildFrenchCitySearchUrl(params.query), {
      signal: params.signal,
    });

    if (cityResponse.ok) {
      const cityData = (await cityResponse.json()) as FrenchCommune[];

      suggestions = [
        ...cityData
          .filter((commune) => communeMatchesQuery(commune, params.query))
          .map(communeToSuggestion)
          .filter((suggestion): suggestion is MapboxSuggestion =>
            Boolean(suggestion)
          ),
        ...suggestions,
      ];
    }
  }

  return rankSuggestions(dedupeSuggestions(suggestions), params.query, params.mode);
}

export async function retrieveSuggestion(params: {
  mapboxId: string;
  token: string;
  sessionToken: string;
}) {
  const url = new URL(`${MAPBOX_SEARCHBOX_URL}/retrieve/${params.mapboxId}`);

  url.searchParams.set("access_token", params.token);
  url.searchParams.set("session_token", params.sessionToken);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("La recuperation du lieu a echoue.");
  }

  const data = (await response.json()) as { features?: MapboxFeature[] };
  const feature = data.features?.[0];

  if (!feature) {
    throw new Error("Aucun lieu recupere.");
  }

  return feature;
}
