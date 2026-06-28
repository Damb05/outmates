"use client";

import { useEffect, useState } from "react";
import Map, { Marker } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "../../lib/supabase";
import { SPORTS, LEVELS } from "../../lib/constants";

type Activity = {
  id: string;
  title: string;
  sport: string;
  level: string;
  meeting_point: string;
  latitude: number;
  longitude: number;
};

export default function MapPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");

  const filteredActivities = activities.filter((activity) => {
    const sportOk =
      selectedSport === "all" || activity.sport === selectedSport;

    const levelOk =
      selectedLevel === "all" || activity.level === selectedLevel;

    return sportOk && levelOk;
  });

  const getSportEmoji = (sportValue: string) => {
    const sport = SPORTS.find((s) => s.value === sportValue);
    return sport?.emoji || "📍";
  };

  useEffect(() => {
    async function fetchActivities() {
      const { data, error } = await supabase
        .from("activities")
        .select("id,title,sport,level,meeting_point,latitude,longitude");

      if (!error && data) {
        setActivities(data);
      }
    }

    fetchActivities();
  }, []);

  return (
    <div className="relative" style={{ width: "100vw", height: "100vh" }}>
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        <select
          value={selectedSport}
          onChange={(e) => setSelectedSport(e.target.value)}
          className="rounded-full bg-white px-4 py-2 shadow"
        >
          <option value="all">Tous les sports</option>

          {SPORTS.map((sport) => (
            <option key={sport.value} value={sport.value}>
              {sport.emoji} {sport.label}
            </option>
          ))}
        </select>

        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="rounded-full bg-white px-4 py-2 shadow"
        >
          <option value="all">Tous les niveaux</option>

          {LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>

        <button className="rounded-full bg-white px-4 py-2 shadow">
          🚺 Genre
        </button>

        <button className="rounded-full bg-white px-4 py-2 shadow">
          📅 Date
        </button>

        <button className="rounded-full bg-white px-4 py-2 shadow">
          🕒 Heure
        </button>
      </div>

      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: 2.35,
          latitude: 48.85,
          zoom: 5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        {filteredActivities.map((activity) => (
          <Marker
            key={activity.id}
            longitude={activity.longitude}
            latitude={activity.latitude}
          >
            <div className="group relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-xl shadow-lg">
                {getSportEmoji(activity.sport)}
              </div>

              <div className="absolute left-1/2 top-12 hidden w-56 -translate-x-1/2 rounded-xl bg-gray-950 p-3 text-white shadow-xl group-hover:block">
                <p className="font-bold">{activity.title}</p>
                <p className="text-sm text-gray-400">
                  Niveau : {activity.level}
                </p>
                <p className="text-sm text-gray-400">
                  📍 {activity.meeting_point}
                </p>
              </div>
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}