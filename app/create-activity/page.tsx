"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SPORTS, LEVELS, GENDERS } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

type Coordinates = {
  longitude: number;
  latitude: number;
};

type MapboxSuggestion = {
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

type MapboxFeature = {
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

type SuggestionMode = "zone" | "point";

type LocationAutocompleteProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  disabled?: boolean;
  selectedBbox?: [number, number, number, number] | null;
  selectedZoneCenter?: Coordinates | null;
  userCoordinates: Coordinates | null;
  mode: SuggestionMode;
  onInputChange: (value: string) => void;
  onSelect: (
    label: string,
    coordinates: Coordinates,
    feature: MapboxFeature
  ) => void;
};

const MAPBOX_SEARCHBOX_URL = "https://api.mapbox.com/search/searchbox/v1";
const FRENCH_CITY_SEARCH_URL = "https://geo.api.gouv.fr/communes";
const FRANCE_BBOX: [number, number, number, number] = [
  -5.6, 41.2, 9.8, 51.3,
];

function createSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatCoordinates(coordinates: Coordinates) {
  return `${coordinates.longitude},${coordinates.latitude}`;
}

function formatBbox(bbox: [number, number, number, number]) {
  return bbox.join(",");
}

function fallbackBbox(center: Coordinates): [number, number, number, number] {
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

function expandBbox(
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

function isInsideBbox(
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

function suggestionLabel(suggestion: MapboxSuggestion) {
  return (
    suggestion.full_address ||
    [suggestion.name_preferred || suggestion.name, suggestion.place_formatted]
      .filter(Boolean)
      .join(", ")
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSuggestionName(suggestion: MapboxSuggestion) {
  return suggestion.name_preferred || suggestion.name;
}

function getSuggestionPostcode(suggestion: MapboxSuggestion) {
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

function getSuggestionSubtitle(suggestion: MapboxSuggestion) {
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

function formatCitySuggestion(suggestion: MapboxSuggestion) {
  const postcode = getSuggestionPostcode(suggestion);

  return `${getSuggestionName(suggestion)}${postcode ? ` (${postcode})` : ""}`;
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

function LocationIcon() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M20 10c0 4.5-8 11-8 11S4 14.5 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </span>
  );
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

function buildRetrieveUrl(params: {
  mapboxId: string;
  token: string;
  sessionToken: string;
}) {
  const url = new URL(`${MAPBOX_SEARCHBOX_URL}/retrieve/${params.mapboxId}`);

  url.searchParams.set("access_token", params.token);
  url.searchParams.set("session_token", params.sessionToken);

  return url;
}

function LocationAutocomplete({
  id,
  label,
  placeholder,
  value,
  disabled = false,
  selectedBbox,
  selectedZoneCenter,
  userCoordinates,
  mode,
  onInputChange,
  onSelect,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState(createSessionToken);
  const skipNextFetchRef = useRef(false);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const proximity =
    mode === "point"
      ? selectedZoneCenter || userCoordinates || "ip"
      : userCoordinates || selectedZoneCenter || "ip";
  const pointSearchBbox = useMemo(
    () => (mode === "point" && selectedBbox ? expandBbox(selectedBbox) : selectedBbox),
    [mode, selectedBbox]
  );

  useEffect(() => {
    if (disabled || skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const query = value.trim();

    if (!mapboxToken || query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          buildSuggestUrl({
            query,
            token: mapboxToken,
            sessionToken,
            mode,
            proximity,
            bbox: pointSearchBbox,
          }),
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("La recherche Mapbox a échoué.");
        }

        const data = (await response.json()) as {
          suggestions?: MapboxSuggestion[];
        };

        let nextSuggestions =
          mode === "zone"
            ? (data.suggestions || []).filter((suggestion) =>
                ["place", "locality"].includes(suggestion.feature_type) &&
                normalizeSearchText(getSuggestionName(suggestion)).includes(
                  normalizeSearchText(query)
                )
              )
            : data.suggestions || [];

        if (mode === "zone") {
          const cityResponse = await fetch(buildFrenchCitySearchUrl(query), {
            signal: controller.signal,
          });

          if (cityResponse.ok) {
            const cityData = (await cityResponse.json()) as FrenchCommune[];

            nextSuggestions = [
              ...cityData
                .filter((commune) => communeMatchesQuery(commune, query))
                .map(communeToSuggestion)
                .filter((suggestion): suggestion is MapboxSuggestion =>
                  Boolean(suggestion)
                ),
              ...nextSuggestions,
            ];
          }
        }

        setSuggestions(
          rankSuggestions(dedupeSuggestions(nextSuggestions), query, mode)
        );
        setIsOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setSuggestions([]);
        setError("Impossible de charger les suggestions.");
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    disabled,
    mapboxToken,
    mode,
    proximity,
    pointSearchBbox,
    sessionToken,
    value,
  ]);

  async function handleSelect(suggestion: MapboxSuggestion) {
    if (suggestion.feature) {
      const [longitude, latitude] = suggestion.feature.geometry.coordinates;

      skipNextFetchRef.current = true;
      onSelect(formatCitySuggestion(suggestion), { longitude, latitude }, suggestion.feature);
      setSuggestions([]);
      setIsOpen(false);
      setSessionToken(createSessionToken());
      return;
    }

    if (!mapboxToken) {
      setError("Token Mapbox manquant.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (!suggestion.mapbox_id) {
        throw new Error("Suggestion Mapbox invalide.");
      }

      const response = await fetch(
        buildRetrieveUrl({
          mapboxId: suggestion.mapbox_id,
          token: mapboxToken,
          sessionToken,
        })
      );

      if (!response.ok) {
        throw new Error("La récupération du lieu a échoué.");
      }

      const data = (await response.json()) as { features?: MapboxFeature[] };
      const feature = data.features?.[0];

      if (!feature) {
        throw new Error("Aucun lieu récupéré.");
      }

      const [longitude, latitude] = feature.geometry.coordinates;
      const coordinates = { longitude, latitude };

      if (
        mode === "point" &&
        pointSearchBbox &&
        !isInsideBbox(coordinates, pointSearchBbox)
      ) {
        setError("Choisis un point précis dans la zone sélectionnée.");
        return;
      }

      const label = suggestionLabel(feature.properties || suggestion);

      skipNextFetchRef.current = true;
      onSelect(label, coordinates, feature);
      setSuggestions([]);
      setIsOpen(false);
      setSessionToken(createSessionToken());
    } catch {
      setError("Impossible de sélectionner ce lieu.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-300">
        {label}
      </label>

      <input
        id={id}
        className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
        onChange={(event) => {
          if (event.target.value.trim().length < 2) {
            setSuggestions([]);
            setError("");
            setIsOpen(false);
          }

          onInputChange(event.target.value);
          setIsOpen(event.target.value.trim().length >= 2);
        }}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
      />

      {isOpen && (suggestions.length > 0 || isLoading || error) && (
        <div className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-2 text-gray-950 shadow-2xl">
          {isLoading && (
            <p className="px-5 py-4 text-sm text-gray-500">Recherche...</p>
          )}

          {!isLoading &&
            suggestions.map((suggestion) => {
              const postcode = getSuggestionPostcode(suggestion);
              const subtitle = getSuggestionSubtitle(suggestion);

              return (
                <button
                  key={suggestion.mapbox_id}
                  type="button"
                  className="flex w-full gap-4 px-5 py-4 text-left transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(suggestion)}
                >
                  <LocationIcon />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold leading-6 text-gray-950">
                      {mode === "zone"
                        ? formatCitySuggestion(suggestion)
                        : getSuggestionName(suggestion)}
                      {mode !== "zone" && postcode && (
                        <span className="font-semibold"> ({postcode})</span>
                      )}
                    </span>

                    {mode !== "zone" && subtitle && (
                      <span className="mt-0.5 block truncate text-sm text-gray-500">
                        {subtitle}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

          {!isLoading && error && (
            <p className="px-5 py-4 text-sm text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreateActivityPage() {
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("running");
  const [description, setDescription] = useState("");

  const [activityZone, setActivityZone] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [zoneBbox, setZoneBbox] = useState<[number, number, number, number] | null>(
    null
  );

  const [meetingPoint, setMeetingPoint] = useState("");
  const [meetingPointLatitude, setMeetingPointLatitude] = useState<number | null>(
    null
  );
  const [meetingPointLongitude, setMeetingPointLongitude] = useState<
    number | null
  >(null);

  const [activityDate, setActivityDate] = useState("");
  const [level, setLevel] = useState("debutant");
  const [genderFilter, setGenderFilter] = useState("all");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [visibility, setVisibility] = useState("public");
  const [message, setMessage] = useState("");
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);

  const selectedZoneCenter = useMemo(() => {
    if (latitude === null || longitude === null) {
      return null;
    }

    return { latitude, longitude };
  }, [latitude, longitude]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 5000 }
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (latitude === null || longitude === null) {
      setMessage("Choisis une ville ou une zone dans les suggestions.");
      return;
    }

    if (
      meetingPoint.trim() &&
      (meetingPointLatitude === null || meetingPointLongitude === null)
    ) {
      setMessage("Sélectionne le point précis dans les suggestions de la zone.");
      return;
    }

    const { error } = await supabase.from("activities").insert({
      title,
      sport,
      description,
      meeting_point: activityZone,
      meeting_point_label: meetingPoint || null,
      activity_date: activityDate,
      latitude,
      longitude,
      level,
      gender_filter: genderFilter,
      max_participants: maxParticipants,
      visibility,
    });

    if (error) {
      setMessage("Erreur : " + error.message);
      return;
    }

    setMessage("Activité créée avec succès !");
    setTitle("");
    setDescription("");
    setActivityZone("");
    setLatitude(null);
    setLongitude(null);
    setZoneBbox(null);
    setMeetingPoint("");
    setMeetingPointLatitude(null);
    setMeetingPointLongitude(null);
    setActivityDate("");
    setMaxParticipants(2);
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold text-emerald-400">
          Créer une activité
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <input
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            placeholder="Titre : Running tranquille au parc"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <select
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
            {SPORTS.map((sport) => (
              <option key={sport.value} value={sport.value}>
                {sport.emoji} {sport.label}
              </option>
            ))}
          </select>

          <textarea
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <LocationAutocomplete
            id="activity-zone"
            label="Ville ou zone"
            placeholder="Hossegor, Annecy, Biarritz..."
            value={activityZone}
            userCoordinates={userCoordinates}
            selectedZoneCenter={selectedZoneCenter}
            mode="zone"
            onInputChange={(value) => {
              setActivityZone(value);
              setLatitude(null);
              setLongitude(null);
              setZoneBbox(null);
              setMeetingPoint("");
              setMeetingPointLatitude(null);
              setMeetingPointLongitude(null);
            }}
            onSelect={(label, coordinates, feature) => {
              setActivityZone(label);
              setLongitude(coordinates.longitude);
              setLatitude(coordinates.latitude);
              setZoneBbox(
                feature.properties.bbox || fallbackBbox(coordinates)
              );
              setMeetingPoint("");
              setMeetingPointLatitude(null);
              setMeetingPointLongitude(null);
            }}
          />

          <LocationAutocomplete
            id="meeting-point"
            label="Point précis facultatif"
            placeholder={
              selectedZoneCenter
                ? "Plage, stade, café, parking..."
                : "Choisis d'abord une ville ou une zone"
            }
            value={meetingPoint}
            disabled={!selectedZoneCenter}
            selectedBbox={zoneBbox}
            selectedZoneCenter={selectedZoneCenter}
            userCoordinates={userCoordinates}
            mode="point"
            onInputChange={(value) => {
              setMeetingPoint(value);
              setMeetingPointLatitude(null);
              setMeetingPointLongitude(null);
            }}
            onSelect={(label, coordinates) => {
              setMeetingPoint(label);
              setMeetingPointLongitude(coordinates.longitude);
              setMeetingPointLatitude(coordinates.latitude);
            }}
          />

          <p className="text-sm text-gray-500">
            Le point précis ne sera pas affiché publiquement. Il sera réservé
            aux participants acceptés.
          </p>

          {meetingPoint &&
            (meetingPointLatitude === null || meetingPointLongitude === null) && (
              <p className="text-sm text-amber-300">
                Sélectionne le point précis dans les suggestions pour le
                verrouiller dans la zone.
              </p>
            )}

          <input
            type="datetime-local"
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            required
          />

          <select
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
          >
            {GENDERS.map((gender) => (
              <option key={gender.value} value={gender.value}>
                {gender.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            max="20"
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(Number(e.target.value))}
          />

          <select
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="public">Public</option>
            <option value="friends">Amis uniquement</option>
            <option value="private">Privé</option>
          </select>

          <button className="w-full rounded-full bg-emerald-500 px-6 py-4 font-bold text-black">
            Publier l&apos;activité
          </button>
        </form>

        {message && <p className="mt-6 text-emerald-400">{message}</p>}
      </div>
    </main>
  );
}
