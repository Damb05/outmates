"use client";

import { useEffect, useState } from "react";
import Map, { Marker } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "../../lib/supabase";
import { SPORTS, LEVELS, GENDERS } from "../../lib/constants";

type Activity = {
  activity_date: string;
  id: string;
  title: string;
  sport: string;
  level: string;
  gender_filter: string;
  meeting_point: string;
  latitude: number;
  longitude: number;
};

export default function MapPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("all");
  const [userLat, setUserLat] = useState<number | null>(null);
const [userLng, setUserLng] = useState<number | null>(null);

  const filteredActivities = activities.filter((activity) => {
    
    const sportOk = selectedSport === "all" || activity.sport === selectedSport;
    const levelOk = selectedLevel === "all" || activity.level === selectedLevel;
    const genderOk =
      selectedGender === "all" || activity.gender_filter === selectedGender;
    const dateOk = selectedDate === "" || activity.activity_date.includes(selectedDate);
const hour = new Date(activity.activity_date).getHours();

const timeOk =
  selectedTime === "all" ||
  (selectedTime === "morning" && hour < 12) ||
  (selectedTime === "afternoon" && hour >= 12 && hour < 18) ||
  (selectedTime === "evening" && hour >= 18);
    return sportOk && levelOk && genderOk && dateOk && timeOk;
  });

  const getSportEmoji = (sportValue: string) => {
    const sport = SPORTS.find((s) => s.value === sportValue);
    return sport?.emoji || "📍";
  };

  useEffect(() => {
    async function fetchActivities() {
      const { data, error } = await supabase
        .from("activities")
        .select("id,title,sport,level,gender_filter,meeting_point,latitude,longitude,activity_date")

      if (!error && data) setActivities(data);
    }

    fetchActivities();
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLat(position.coords.latitude);
        setUserLng(position.coords.longitude);
      },
      (error) => {
        console.log(error);
      }
    );
  }, []);

  return (
    <div className="relative" style={{ width: "100vw", height: "100vh" }}>
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        <select value={selectedSport} onChange={(e) => setSelectedSport(e.target.value)} className="rounded-full bg-white px-4 py-2 shadow">
          <option value="all">Tous les sports</option>
          {SPORTS.map((sport) => (
            <option key={sport.value} value={sport.value}>{sport.emoji} {sport.label}</option>
          ))}
        </select>

        <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="rounded-full bg-white px-4 py-2 shadow">
          <option value="all">Tous les niveaux</option>
          {LEVELS.map((level) => (
            <option key={level.value} value={level.value}>{level.label}</option>
          ))}
        </select>

        <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)} className="rounded-full bg-white px-4 py-2 shadow">
          <option value="all">Tous les genres</option>
          {GENDERS.map((gender) => (
            <option key={gender.value} value={gender.value}>{gender.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-full bg-white px-4 py-2 shadow"
        />

        <select
  value={selectedTime}
  onChange={(e) => setSelectedTime(e.target.value)}
  className="rounded-full bg-white px-4 py-2 shadow"
>

<option value="all">Toute la journée</option>

<option value="morning">🌅 Matin</option>

<option value="afternoon">☀️ Après-midi</option>

<option value="evening">🌙 Soirée</option>

</select>

      </div>

      <Map mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} initialViewState={{

longitude: userLng ?? 2.35,

latitude: userLat ?? 48.85,

zoom: userLat ? 11 : 5,

}} style={{ width: "100%", height: "100%" }} mapStyle="mapbox://styles/mapbox/streets-v12">
        {userLat && userLng && (

<Marker

longitude={userLng}

latitude={userLat}

>

<div className="text-3xl">

📍

</div>

</Marker>

)}
        {filteredActivities.map((activity) => (
          <Marker key={activity.id} longitude={activity.longitude} latitude={activity.latitude}>
            <div className="group relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-xl shadow-lg">
                {getSportEmoji(activity.sport)}
              </div>

              <div className="absolute left-1/2 top-12 hidden w-56 -translate-x-1/2 rounded-xl bg-gray-950 p-3 text-white shadow-xl group-hover:block">
                <p className="font-bold">{activity.title}</p>
                <p className="text-sm text-gray-400">Niveau : {activity.level}</p>
                <p className="text-sm text-gray-400">Genre : {activity.gender_filter}</p>
                <p className="text-sm text-gray-400">📍 {activity.meeting_point}</p>
              </div>
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}