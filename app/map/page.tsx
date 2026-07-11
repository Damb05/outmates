"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import ActivityDetailModal from "../../components/ActivityDetailModal";
import { type Activity, SPORT_META } from "../../components/ActivityCard";
import { SPORTS, LEVELS, GENDERS } from "../../lib/constants";
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

const DEFAULT_VIEW_STATE = {
  longitude: 2.35,
  latitude: 48.85,
  zoom: 5,
};

const RADIUS_OPTIONS = [0, 2, 5, 10, 25, 50];

function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapPage() {
  const mapRef = useRef<MapRef | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("all");
  const [selectedRadius, setSelectedRadius] = useState(10);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<MapboxSuggestion[]>([]);
  const [isCitySearchOpen, setIsCitySearchOpen] = useState(false);
  const [isCitySearchLoading, setIsCitySearchLoading] = useState(false);
  const [citySearchError, setCitySearchError] = useState("");
  const [sessionToken, setSessionToken] = useState(createSessionToken);
  const [mapMessage, setMapMessage] = useState("");
  const skipNextCityFetchRef = useRef(false);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const searchProximity = useMemo<Coordinates | "ip">(
    () =>
      userLat !== null && userLng !== null
        ? { latitude: userLat, longitude: userLng }
        : "ip",
    [userLat, userLng]
  );

  useEffect(() => {
    async function fetchActivities() {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("activity_date", { ascending: true });

      if (!error && data) {
        setActivities(data as Activity[]);
      }
    }

    fetchActivities();
  }, []);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (activity.latitude === null || activity.longitude === null) {
        return false;
      }

      const sportOk =
        selectedSport === "all" || activity.sport === selectedSport;
      const levelOk =
        selectedLevel === "all" || activity.level === selectedLevel;
      const genderOk =
        selectedGender === "all" || activity.gender_filter === selectedGender;
      const dateOk =
        selectedDate === "" || activity.activity_date.includes(selectedDate);
      const hour = new Date(activity.activity_date).getHours();
      const timeOk =
        selectedTime === "all" ||
        (selectedTime === "morning" && hour < 12) ||
        (selectedTime === "afternoon" && hour >= 12 && hour < 18) ||
        (selectedTime === "evening" && hour >= 18);
      const distanceOk =
        selectedRadius === 0 ||
        userLat === null ||
        userLng === null ||
        getDistanceKm(userLat, userLng, activity.latitude, activity.longitude) <=
          selectedRadius;

      return sportOk && levelOk && genderOk && dateOk && timeOk && distanceOk;
    });
  }, [
    activities,
    selectedDate,
    selectedGender,
    selectedLevel,
    selectedRadius,
    selectedSport,
    selectedTime,
    userLat,
    userLng,
  ]);

  function flyTo(longitude: number, latitude: number, zoom = 12) {
    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom,
      duration: 900,
    });
  }

  useEffect(() => {
    if (skipNextCityFetchRef.current) {
      skipNextCityFetchRef.current = false;
      return;
    }

    const query = cityQuery.trim();

    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsCitySearchLoading(true);
      setCitySearchError("");

      try {
        setCitySuggestions(
          await fetchLocationSuggestions({
            query,
            token: mapboxToken,
            sessionToken,
            mode: "zone",
            proximity: searchProximity,
            signal: controller.signal,
          })
        );
        setIsCitySearchOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setCitySuggestions([]);
        setCitySearchError("Impossible de charger les suggestions.");
      } finally {
        setIsCitySearchLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cityQuery, mapboxToken, searchProximity, sessionToken]);

  async function handleCitySelect(suggestion: MapboxSuggestion) {
    if (suggestion.feature) {
      const [longitude, latitude] = suggestion.feature.geometry.coordinates;

      skipNextCityFetchRef.current = true;
      setCityQuery(formatCitySuggestion(suggestion));
      setCitySuggestions([]);
      setIsCitySearchOpen(false);
      setSessionToken(createSessionToken());
      flyTo(longitude, latitude, 12);
      setMapMessage(`Carte centree sur ${getSuggestionName(suggestion)}.`);
      return;
    }

    if (!mapboxToken || !suggestion.mapbox_id) {
      setCitySearchError("Suggestion invalide.");
      return;
    }

    setIsCitySearchLoading(true);
    setCitySearchError("");

    try {
      const feature = await retrieveSuggestion({
        mapboxId: suggestion.mapbox_id,
        token: mapboxToken,
        sessionToken,
      });

      const [longitude, latitude] = feature.geometry.coordinates;
      const label = suggestionLabel(feature.properties || suggestion);

      skipNextCityFetchRef.current = true;
      setCityQuery(label);
      setCitySuggestions([]);
      setIsCitySearchOpen(false);
      setSessionToken(createSessionToken());
      flyTo(longitude, latitude, 12);
      setMapMessage(`Carte centree sur ${getSuggestionName(suggestion)}.`);
    } catch {
      setCitySearchError("Impossible de selectionner cette ville.");
    } finally {
      setIsCitySearchLoading(false);
    }
  }

  function handleCitySearch() {
    const query = cityQuery.trim();

    if (query.length < 2) {
      setMapMessage("Saisis au moins 2 lettres pour chercher une ville.");
      return;
    }

    const firstSuggestion = citySuggestions[0];

    if (firstSuggestion) {
      handleCitySelect(firstSuggestion);
      return;
    }

    setMapMessage("Choisis une ville dans les suggestions.");
  }

  function handleLocateMe() {
    if (!("geolocation" in navigator)) {
      setMapMessage("La geolocalisation n'est pas disponible.");
      return;
    }

    setMapMessage("Recherche de ta position...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setUserLat(latitude);
        setUserLng(longitude);
        flyTo(longitude, latitude, 12);
        setMapMessage("Carte centree autour de toi.");
      },
      () => {
        setMapMessage("Impossible d'acceder a ta position.");
      },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 7000 }
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-950">
      <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100vw-2rem)] flex-wrap gap-2">
        <div className="relative">
          <div className="flex overflow-hidden rounded-full bg-white shadow">
            <input
              className="w-52 px-4 py-2 text-sm text-gray-950 outline-none placeholder:text-gray-500"
              placeholder="Chercher une ville"
              value={cityQuery}
              autoComplete="off"
              onBlur={() =>
                window.setTimeout(() => setIsCitySearchOpen(false), 150)
              }
              onChange={(event) => {
                if (event.target.value.trim().length < 2) {
                  setCitySuggestions([]);
                  setCitySearchError("");
                  setIsCitySearchOpen(false);
                }

                setCityQuery(event.target.value);
                setIsCitySearchOpen(event.target.value.trim().length >= 2);
              }}
              onFocus={() => {
                if (citySuggestions.length > 0) {
                  setIsCitySearchOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleCitySearch();
                }
              }}
            />
            <button
              type="button"
              className="bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400"
              onClick={handleCitySearch}
            >
              OK
            </button>
          </div>

          {isCitySearchOpen &&
            (citySuggestions.length > 0 ||
              isCitySearchLoading ||
              citySearchError) && (
              <div className="absolute z-20 mt-2 max-h-80 w-72 overflow-auto rounded-xl border border-gray-200 bg-white py-2 text-gray-950 shadow-2xl">
                {isCitySearchLoading && (
                  <p className="px-5 py-4 text-sm text-gray-500">
                    Recherche...
                  </p>
                )}

                {!isCitySearchLoading &&
                  citySuggestions.map((suggestion) => {
                    const subtitle = getSuggestionSubtitle(suggestion);

                    return (
                      <button
                        key={suggestion.mapbox_id}
                        type="button"
                        className="flex w-full gap-3 px-5 py-3 text-left transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleCitySelect(suggestion)}
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

                {!isCitySearchLoading && citySearchError && (
                  <p className="px-5 py-4 text-sm text-red-600">
                    {citySearchError}
                  </p>
                )}
              </div>
            )}
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-950 shadow transition hover:bg-emerald-100"
          onClick={handleLocateMe}
          aria-label="Me localiser"
          title="Me localiser"
        >
          {"\u2316"}
        </button>

        <select
          value={selectedSport}
          onChange={(event) => setSelectedSport(event.target.value)}
          className="rounded-full bg-white px-4 py-2 text-sm text-gray-950 shadow"
        >
          <option value="all">Tous les sports</option>
          {SPORTS.map((sport) => (
            <option key={sport.value} value={sport.value}>
              {sport.label}
            </option>
          ))}
        </select>

        <select
          value={selectedLevel}
          onChange={(event) => setSelectedLevel(event.target.value)}
          className="rounded-full bg-white px-4 py-2 text-sm text-gray-950 shadow"
        >
          <option value="all">Tous les niveaux</option>
          {LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>

        <select
          value={selectedGender}
          onChange={(event) => setSelectedGender(event.target.value)}
          className="rounded-full bg-white px-4 py-2 text-sm text-gray-950 shadow"
        >
          <option value="all">Tous les genres</option>
          {GENDERS.map((gender) => (
            <option key={gender.value} value={gender.value}>
              {gender.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="rounded-full bg-white px-4 py-2 text-sm text-gray-950 shadow"
        />

        <select
          value={selectedTime}
          onChange={(event) => setSelectedTime(event.target.value)}
          className="rounded-full bg-white px-4 py-2 text-sm text-gray-950 shadow"
        >
          <option value="all">Toute la journee</option>
          <option value="morning">Matin</option>
          <option value="afternoon">Apres-midi</option>
          <option value="evening">Soiree</option>
        </select>

        <select
          value={selectedRadius}
          onChange={(event) => setSelectedRadius(Number(event.target.value))}
          className="rounded-full bg-white px-4 py-2 text-sm text-gray-950 shadow"
        >
          {RADIUS_OPTIONS.map((radius) => (
            <option key={radius} value={radius}>
              {radius === 0 ? "Sans rayon" : `${radius} km`}
            </option>
          ))}
        </select>

        {mapMessage && (
          <p className="w-full rounded-full bg-gray-950/90 px-4 py-2 text-sm text-white shadow">
            {mapMessage}
          </p>
        )}
      </div>

      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={DEFAULT_VIEW_STATE}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        {userLat !== null && userLng !== null && (
          <Marker longitude={userLng} latitude={userLat}>
            <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
          </Marker>
        )}

        {filteredActivities.map((activity) => {
          const sport = SPORT_META[activity.sport] || {
            icon: "\u{1F4CD}",
            label: activity.sport,
          };

          if (activity.latitude === null || activity.longitude === null) {
            return null;
          }

          return (
            <Marker
              key={activity.id}
              longitude={activity.longitude}
              latitude={activity.latitude}
            >
              <button
                type="button"
                className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-xl shadow-lg transition hover:scale-110"
                onClick={() => setSelectedActivity(activity)}
                aria-label={`Voir ${activity.title}`}
              >
                {sport.icon}

                <span className="pointer-events-none absolute left-1/2 top-12 hidden w-56 -translate-x-1/2 rounded-xl bg-gray-950 p-3 text-left text-white shadow-xl group-hover:block">
                  <span className="block font-bold">{activity.title}</span>
                  <span className="mt-1 block text-sm text-gray-400">
                    {sport.label}
                  </span>
                  <span className="mt-1 block text-sm text-gray-400">
                    {"\u{1F4CD}"} {activity.meeting_point}
                  </span>
                </span>
              </button>
            </Marker>
          );
        })}
      </Map>

      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
}
