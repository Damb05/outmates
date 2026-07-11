"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ActivityCard, { type Activity } from "../../components/ActivityCard";
import ActivityDetailModal from "../../components/ActivityDetailModal";
import {
  createSessionToken,
  fetchLocationSuggestions,
  formatCitySuggestion,
  getSuggestionName,
  getSuggestionSubtitle,
  retrieveSuggestion,
  suggestionLabel,
  type Coordinates,
  type MapboxSuggestion,
} from "../../lib/locationSuggestions";
import { supabase } from "../../lib/supabase";

const SPORT_FILTERS = [
  { value: "all", label: "Tous les sports" },
  { value: "running", label: "Running" },
  { value: "trail", label: "Trail" },
  { value: "bike", label: "Velo" },
  { value: "hiking", label: "Randonnee" },
  { value: "tennis", label: "Tennis" },
  { value: "surf", label: "Surf" },
];

const LEVEL_FILTERS = [
  { value: "all", label: "Tous les niveaux" },
  { value: "debutant", label: "Debutant" },
  { value: "initie", label: "Initie" },
  { value: "intermediaire", label: "Intermediaire" },
  { value: "avance", label: "Avance" },
  { value: "expert", label: "Expert" },
];

const DATE_FILTERS = [
  { value: "all", label: "Toutes les dates" },
  { value: "today", label: "Aujourd'hui" },
  { value: "tomorrow", label: "Demain" },
  { value: "week", label: "Cette semaine" },
  { value: "weekend", label: "Ce week-end" },
];

const VISIBILITY_FILTERS = [
  { value: "all", label: "Toutes les visibilites" },
  { value: "public", label: "Public" },
  { value: "friends", label: "Amis uniquement" },
  { value: "private", label: "Prive" },
];

const LOCATION_FILTERS = [
  { value: "all", label: "Toutes les zones" },
  { value: "near_me", label: "Autour de moi" },
  { value: "zone", label: "Zone saisie" },
];

const RADIUS_FILTERS = [5, 10, 25, 50, 100];
const RECENT_PAST_ACTIVITY_WINDOW_MS = 2 * 60 * 60 * 1000;

function isSameDay(firstDate: Date, secondDate: Date) {
  return firstDate.toDateString() === secondDate.toDateString();
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function isThisWeek(date: Date, now: Date) {
  const weekEnd = addDays(now, 7);
  return date >= now && date <= weekEnd;
}

function isThisWeekend(date: Date, now: Date) {
  const day = date.getDay();
  return isThisWeek(date, now) && (day === 0 || day === 6);
}

function getDistanceKm(
  firstCoordinates: Coordinates,
  secondCoordinates: Coordinates
) {
  const earthRadiusKm = 6371;
  const latitudeDelta =
    ((secondCoordinates.latitude - firstCoordinates.latitude) * Math.PI) / 180;
  const longitudeDelta =
    ((secondCoordinates.longitude - firstCoordinates.longitude) * Math.PI) / 180;
  const firstLatitude = (firstCoordinates.latitude * Math.PI) / 180;
  const secondLatitude = (secondCoordinates.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return (
    earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function isRecentlyPastActivity(activityDate: Date, now: Date) {
  const elapsedMs = now.getTime() - activityDate.getTime();

  return elapsedMs >= 0 && elapsedMs <= RECENT_PAST_ACTIVITY_WINDOW_MS;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedVisibility, setSelectedVisibility] = useState("all");
  const [selectedLocationMode, setSelectedLocationMode] = useState("all");
  const [selectedRadius, setSelectedRadius] = useState(25);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<
    MapboxSuggestion[]
  >([]);
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
  const [isLocationSearchLoading, setIsLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState("");
  const [sessionToken, setSessionToken] = useState(createSessionToken);
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(
    null
  );
  const [zoneCoordinates, setZoneCoordinates] = useState<Coordinates | null>(
    null
  );
  const [locationMessage, setLocationMessage] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const skipNextLocationFetchRef = useRef(false);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    async function fetchActivities() {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("activity_date", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setActivities((data || []) as Activity[]);
    }

    fetchActivities();
  }, []);

  useEffect(() => {
    if (selectedLocationMode !== "near_me") {
      return;
    }

    if (!("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationMessage("Position detectee.");
      },
      () => {
        setUserCoordinates(null);
        setLocationMessage("Impossible d'acceder a ta position.");
      },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 7000 }
    );
  }, [selectedLocationMode]);

  useEffect(() => {
    if (selectedLocationMode !== "zone") {
      return;
    }

    if (skipNextLocationFetchRef.current) {
      skipNextLocationFetchRef.current = false;
      return;
    }

    const query = locationQuery.trim();

    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLocationSearchLoading(true);
      setLocationSearchError("");

      try {
        setLocationSuggestions(
          await fetchLocationSuggestions({
            query,
            token: mapboxToken,
            sessionToken,
            mode: "zone",
            proximity: userCoordinates || "ip",
            signal: controller.signal,
          })
        );
        setIsLocationSearchOpen(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLocationSuggestions([]);
        setLocationSearchError("Impossible de charger les suggestions.");
      } finally {
        setIsLocationSearchLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    locationQuery,
    mapboxToken,
    selectedLocationMode,
    sessionToken,
    userCoordinates,
  ]);

  async function handleLocationSelect(suggestion: MapboxSuggestion) {
    if (suggestion.feature) {
      const [longitude, latitude] = suggestion.feature.geometry.coordinates;

      skipNextLocationFetchRef.current = true;
      setLocationQuery(formatCitySuggestion(suggestion));
      setZoneCoordinates({ latitude, longitude });
      setLocationSuggestions([]);
      setIsLocationSearchOpen(false);
      setSessionToken(createSessionToken());
      setLocationMessage(`Zone detectee : ${getSuggestionName(suggestion)}.`);
      return;
    }

    if (!mapboxToken || !suggestion.mapbox_id) {
      setLocationSearchError("Suggestion invalide.");
      return;
    }

    setIsLocationSearchLoading(true);
    setLocationSearchError("");

    try {
      const feature = await retrieveSuggestion({
        mapboxId: suggestion.mapbox_id,
        token: mapboxToken,
        sessionToken,
      });
      const [longitude, latitude] = feature.geometry.coordinates;

      skipNextLocationFetchRef.current = true;
      setLocationQuery(suggestionLabel(feature.properties || suggestion));
      setZoneCoordinates({ latitude, longitude });
      setLocationSuggestions([]);
      setIsLocationSearchOpen(false);
      setSessionToken(createSessionToken());
      setLocationMessage(`Zone detectee : ${getSuggestionName(suggestion)}.`);
    } catch {
      setLocationSearchError("Impossible de selectionner cette zone.");
    } finally {
      setIsLocationSearchLoading(false);
    }
  }

  const filteredActivities = useMemo(() => {
    const now = new Date();

    return activities.filter((activity) => {
      const activityDate = new Date(activity.activity_date);
      const isFuture = activityDate > now;
      const isVisibleByTime =
        isFuture || isRecentlyPastActivity(activityDate, now);
      const sportOk =
        selectedSport === "all" || activity.sport === selectedSport;
      const levelOk =
        selectedLevel === "all" || activity.level === selectedLevel;
      const visibilityOk =
        selectedVisibility === "all" ||
        activity.visibility === selectedVisibility;
      const activityCoordinates =
        activity.latitude !== null && activity.longitude !== null
          ? { latitude: activity.latitude, longitude: activity.longitude }
          : null;
      const locationCenter =
        selectedLocationMode === "near_me" ? userCoordinates : zoneCoordinates;
      const locationOk =
        selectedLocationMode === "all" ||
        !locationCenter ||
        (activityCoordinates !== null &&
          getDistanceKm(locationCenter, activityCoordinates) <= selectedRadius);
      const dateOk =
        selectedDate === "all" ||
        (selectedDate === "today" && isSameDay(activityDate, now)) ||
        (selectedDate === "tomorrow" &&
          isSameDay(activityDate, addDays(now, 1))) ||
        (selectedDate === "week" && isThisWeek(activityDate, now)) ||
        (selectedDate === "weekend" && isThisWeekend(activityDate, now));

      return (
        isVisibleByTime &&
        sportOk &&
        levelOk &&
        visibilityOk &&
        dateOk &&
        locationOk
      );
    });
  }, [
    activities,
    selectedDate,
    selectedLevel,
    selectedLocationMode,
    selectedRadius,
    selectedSport,
    selectedVisibility,
    userCoordinates,
    zoneCoordinates,
  ]);

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">
              Outmates
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
              Activites a venir
            </h1>
            <p className="mt-3 max-w-2xl text-gray-400">
              Trouve une sortie sportive, rejoins un petit groupe et pars bouger
              avec des personnes proches de toi.
            </p>
          </div>

          <Link
            href="/create-activity"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 font-bold text-black transition hover:bg-emerald-400"
          >
            Creer une activite
          </Link>
        </div>

        <section className="mt-8 grid gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 md:grid-cols-4">
          <select
            className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
            value={selectedSport}
            onChange={(event) => setSelectedSport(event.target.value)}
          >
            {SPORT_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
            value={selectedLevel}
            onChange={(event) => setSelectedLevel(event.target.value)}
          >
            {LEVEL_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          >
            {DATE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
            value={selectedVisibility}
            onChange={(event) => setSelectedVisibility(event.target.value)}
          >
            {VISIBILITY_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </section>

        <section className="mt-4 grid gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 md:grid-cols-[1fr_1fr_140px]">
          <select
            className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
            value={selectedLocationMode}
            onChange={(event) => {
              const nextMode = event.target.value;

              setSelectedLocationMode(nextMode);
              setLocationMessage("");

              if (nextMode !== "zone") {
                setZoneCoordinates(null);
                setLocationQuery("");
                setLocationSuggestions([]);
                setIsLocationSearchOpen(false);
                setLocationSearchError("");
              }

              if (nextMode !== "near_me") {
                setUserCoordinates(null);
              } else if (!("geolocation" in navigator)) {
                setLocationMessage("La geolocalisation n'est pas disponible.");
              } else {
                setLocationMessage("Recherche de ta position...");
              }
            }}
          >
            {LOCATION_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <div className="relative">
            <input
              className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Saisis une ville ou une zone"
              value={locationQuery}
              disabled={selectedLocationMode !== "zone"}
              autoComplete="off"
              onBlur={() =>
                window.setTimeout(() => setIsLocationSearchOpen(false), 150)
              }
              onChange={(event) => {
                if (event.target.value.trim().length < 2) {
                  setLocationSuggestions([]);
                  setLocationSearchError("");
                  setIsLocationSearchOpen(false);
                }

                setLocationQuery(event.target.value);
                setZoneCoordinates(null);
                setLocationMessage("");
                setIsLocationSearchOpen(event.target.value.trim().length >= 2);
              }}
              onFocus={() => {
                if (locationSuggestions.length > 0) {
                  setIsLocationSearchOpen(true);
                }
              }}
            />

            {isLocationSearchOpen &&
              (locationSuggestions.length > 0 ||
                isLocationSearchLoading ||
                locationSearchError) && (
                <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-2 text-gray-950 shadow-2xl">
                  {isLocationSearchLoading && (
                    <p className="px-5 py-4 text-sm text-gray-500">
                      Recherche...
                    </p>
                  )}

                  {!isLocationSearchLoading &&
                    locationSuggestions.map((suggestion) => {
                      const subtitle = getSuggestionSubtitle(suggestion);

                      return (
                        <button
                          key={suggestion.mapbox_id}
                          type="button"
                          className="flex w-full gap-3 px-5 py-3 text-left transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleLocationSelect(suggestion)}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                            {"\u2316"}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-950">
                              {formatCitySuggestion(suggestion)}
                            </span>

                            {subtitle && (
                              <span className="mt-0.5 block truncate text-xs text-gray-500">
                                {subtitle}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {!isLocationSearchLoading && locationSearchError && (
                    <p className="px-5 py-4 text-sm text-red-600">
                      {locationSearchError}
                    </p>
                  )}
                </div>
              )}
          </div>

          <select
            className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
            value={selectedRadius}
            onChange={(event) => setSelectedRadius(Number(event.target.value))}
          >
            {RADIUS_FILTERS.map((radius) => (
              <option key={radius} value={radius}>
                {radius} km
              </option>
            ))}
          </select>

          {locationMessage && (
            <p className="text-sm text-gray-400 md:col-span-3">
              {locationMessage}
            </p>
          )}
        </section>

        {errorMessage && (
          <p className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-red-200">
            Erreur : {errorMessage}
          </p>
        )}

        {!errorMessage && filteredActivities.length === 0 && (
          <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
            <h2 className="text-2xl font-bold text-white">
              Aucune activite disponible.
            </h2>
            <p className="mt-3 text-gray-400">
              Cree la premiere sortie pres de chez toi.
            </p>
            <Link
              href="/create-activity"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 font-bold text-black transition hover:bg-emerald-400"
            >
              Creer une activite
            </Link>
          </section>
        )}

        {filteredActivities.length > 0 && (
          <section className="mt-8 grid gap-4">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                disabled={new Date(activity.activity_date) <= new Date()}
                disabledLabel="Terminee"
                onSelect={setSelectedActivity}
              />
            ))}
          </section>
        )}
      </div>

      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </main>
  );
}
