"use client";

import { SPORTS, LEVELS, GENDERS } from "../../lib/constants"
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CreateActivityPage() {
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("running");
  const [description, setDescription] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [level, setLevel] = useState("debutant");
  const [genderFilter, setGenderFilter] = useState("all");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [visibility, setVisibility] = useState("public");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.from("activities").insert({
      title,
      sport,
      description,
      meeting_point: meetingPoint,
      activity_date: activityDate,
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
    setMeetingPoint("");
    setActivityDate("");
    setMaxParticipants(2);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold text-emerald-400">
          Créer une activité
        </h1>

        <p className="mt-3 text-gray-400">
          Publie une sortie et choisis qui peut demander à participer.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <input
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            placeholder="Titre : Running tranquille au parc"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <select
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
            {SPORTS.map((sport)=>(

<option
key={sport.value}
value={sport.value}
>

{sport.emoji} {sport.label}

</option>

))}
          </select>

          <textarea
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <input
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            placeholder="Lieu de rendez-vous"
            value={meetingPoint}
            onChange={(e) => setMeetingPoint(e.target.value)}
            required
          />

          <input
            type="datetime-local"
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            required
          />

          <select
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {LEVELS.map((level)=>(

<option
key={level.value}
value={level.value}
>

{level.label}

</option>

))}
          </select>

          <select
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
          >
            {GENDERS.map((gender) => (

<option
  key={gender.value}
  value={gender.value}
>

{gender.label}

</option>

))}
          </select>

          <input
            type="number"
            min="1"
            max="20"
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(Number(e.target.value))}
          />

          <select
            className="w-full rounded-xl bg-gray-900 border border-gray-800 px-4 py-3"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="public">Public</option>
            <option value="friends">Amis uniquement</option>
            <option value="private">Privé</option>
          </select>

          <button className="w-full rounded-full bg-emerald-500 px-6 py-4 font-bold text-black">
            Publier l’activité
          </button>
        </form>

        {message && <p className="mt-6 text-emerald-400">{message}</p>}
      </div>
    </main>
  );
}