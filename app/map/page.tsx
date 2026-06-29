"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import ActivityDetailModal from "../../components/ActivityDetailModal";
import { type Activity, SPORT_META } from "../../components/ActivityCard";
import { supabase } from "../../lib/supabase";
import { SPORTS, LEVELS, GENDERS } from "../../lib/constants";

type CitySearchResult = {
  nom: string;
  centre?: {
    coordinates: [number, number];
  };
};

const DEFAULT_VIEW_STATE = {
  longitude: 2.35,
  latitude: 48.85,
  zoom: 5,
};

const RADIUS_OPTIONS = [0, 2, 5, 10, 25, 50];
const FRENCH_CITY_SEARCH_URL = "https://geo.api.gouv.fr/communes";

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

function buildCitySearchUrl(query: string) {
  const url = new URL(FRENCH_CITY_SEARCH_URL);

  url.searchParams.set("nom", query);
  url.searchParams.set("fields", "nom,centre");
  url.searchParams.set("boost", "population");
  url.searchParams.set("limit", "1");

  return url;
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
  const [mapMessage, setMapMessage] = useState("");

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

  async function handleCitySearch() {
    const query = cityQuery.trim();

    if (query.length < 2) {
      setMapMessage("Saisis au moins 2 lettres pour chercher une ville.");
      return;
    }

    try {
      setMapMessage("Recherche de la ville...");
      const response = await fetch(buildCitySearchUrl(query));

      if (!response.ok) {
        throw new Error("Ville introuvable.");
      }

      const results = (await response.json()) as CitySearchResult[];
      const city = results[0];

      if (!city?.centre) {
        throw new Error("Ville introuvable.");
      }

      const [longitude, latitude] = city.centre.coordinates;
      flyTo(longitude, latitude, 12);
      setMapMessage(`Carte centree sur ${city.nom}.`);
    } catch {
      setMapMessage("Ville introuvable.");
    }
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
        <div className="flex overflow-hidden rounded-full bg-white shadow">
          <input
            className="w-52 px-4 py-2 text-sm text-gray-950 outline-none placeholder:text-gray-500"
            placeholder="Chercher une ville"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
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
