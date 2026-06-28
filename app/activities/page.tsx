"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Activity = {
  id: string;
  title: string;
  sport: string;
  meeting_point: string;
  activity_date: string;
  max_participants: number;
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

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

      setActivities(data || []);
    }

    fetchActivities();
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="mb-8 text-4xl font-bold text-emerald-400">
        Activités
      </h1>

      {errorMessage && (
        <p className="mb-6 rounded-xl bg-red-900/40 p-4 text-red-300">
          Erreur : {errorMessage}
        </p>
      )}

      {activities.length === 0 && !errorMessage && (
        <p className="text-gray-400">Aucune activité pour le moment.</p>
      )}

      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6"
          >
            <h2 className="text-xl font-bold">{activity.title}</h2>
            <p className="text-gray-400">{activity.sport}</p>
            <p>📍 {activity.meeting_point}</p>
            <p>📅 {activity.activity_date}</p>
            <p>👥 {activity.max_participants} places</p>
          </div>
        ))}
      </div>
    </main>
  );
}