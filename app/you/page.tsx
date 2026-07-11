"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ActivityCard, {
  formatActivityDate,
  type Activity,
} from "../../components/ActivityCard";
import ActivityDetailModal from "../../components/ActivityDetailModal";
import {
  answerParticipationRequest,
  type Participation,
} from "../../lib/participation";
import { supabase } from "../../lib/supabase";

type Tab = "upcoming" | "requested" | "history";

type ActivityWithRole = Activity & {
  viewerRole: "organizer" | "participant";
};

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "upcoming", label: "Activités à venir" },
  { value: "requested", label: "Demandées" },
  { value: "history", label: "Historique" },
];

function isPastActivity(activity: Activity) {
  return new Date(activity.activity_date) <= new Date();
}

export default function YouPage() {
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [organizedActivities, setOrganizedActivities] = useState<Activity[]>([]);
  const [joinedParticipations, setJoinedParticipations] = useState<
    Participation[]
  >([]);
  const [requestedParticipations, setRequestedParticipations] = useState<
    Participation[]
  >([]);
  const [receivedRequests, setReceivedRequests] = useState<Participation[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function fetchYouData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsLoading(true);
    setMessage("");

    if (!user) {
      setMessage("Connecte-toi pour retrouver tes activités.");
      setIsLoading(false);
      return;
    }

    const [organizedResult, acceptedResult, pendingResult] = await Promise.all([
      supabase
        .from("activities")
        .select("*")
        .eq("organizer_id", user.id)
        .order("activity_date", { ascending: true }),
      supabase
        .from("participants")
        .select("*, activity:activities(*)")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false }),
      supabase
        .from("participants")
        .select("*, activity:activities(*)")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (organizedResult.error) {
      setMessage(organizedResult.error.message);
      setIsLoading(false);
      return;
    }

    const nextOrganizedActivities = (organizedResult.data || []) as Activity[];
    setOrganizedActivities(nextOrganizedActivities);

    let nextReceivedRequests: Participation[] = [];

    if (nextOrganizedActivities.length > 0) {
      const { data, error } = await supabase
        .from("participants")
        .select("*, activity:activities(*)")
        .eq("status", "pending")
        .in(
          "activity_id",
          nextOrganizedActivities.map((activity) => activity.id)
        )
        .order("created_at", { ascending: true });

      if (error) {
        setMessage(error.message);
      } else {
        nextReceivedRequests = (data || []) as Participation[];
      }
    }

    if (acceptedResult.error || pendingResult.error) {
      setMessage(
        acceptedResult.error?.message ||
          pendingResult.error?.message ||
          "Impossible de charger tes activités."
      );
    }

    setJoinedParticipations((acceptedResult.data || []) as Participation[]);
    setRequestedParticipations((pendingResult.data || []) as Participation[]);
    setReceivedRequests(nextReceivedRequests);
    setIsLoading(false);

  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchYouData();
    });
  }, []);

  const upcomingActivities = useMemo(() => {
    const organized: ActivityWithRole[] = organizedActivities.map((activity) => ({
      ...activity,
      viewerRole: "organizer",
    }));
    const joined: ActivityWithRole[] = joinedParticipations
      .map((participation) => participation.activity)
      .filter((activity): activity is Activity => Boolean(activity))
      .map((activity) => ({ ...activity, viewerRole: "participant" }));

    return [...organized, ...joined]
      .filter((activity) => !isPastActivity(activity))
      .sort(
        (first, second) =>
          new Date(first.activity_date).getTime() -
          new Date(second.activity_date).getTime()
      );
  }, [joinedParticipations, organizedActivities]);

  const historyActivities = useMemo(() => {
    const organized: ActivityWithRole[] = organizedActivities.map((activity) => ({
      ...activity,
      viewerRole: "organizer",
    }));
    const joined: ActivityWithRole[] = joinedParticipations
      .map((participation) => participation.activity)
      .filter((activity): activity is Activity => Boolean(activity))
      .map((activity) => ({ ...activity, viewerRole: "participant" }));

    return [...organized, ...joined]
      .filter(isPastActivity)
      .sort(
        (first, second) =>
          new Date(second.activity_date).getTime() -
          new Date(first.activity_date).getTime()
      );
  }, [joinedParticipations, organizedActivities]);

  async function answerRequest(
    participation: Participation,
    status: "accepted" | "rejected"
  ) {
    const result = await answerParticipationRequest({ participation, status });
    setMessage(result.message);

    if (result.ok) {
      await fetchYouData();
    }
  }

  function renderRoleBadge(role: ActivityWithRole["viewerRole"]) {
    if (role === "organizer") {
      return (
        <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-black">
          Organisateur
        </span>
      );
    }

    return (
      <span className="rounded-full border border-blue-400/50 px-3 py-1 text-xs font-bold text-blue-200">
        Participant
      </span>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">
              Outmates
            </p>
            <h1 className="mt-3 text-4xl font-bold">Vous</h1>
          </div>

          <Link
            href="/notifications"
            className="rounded-full border border-gray-700 px-4 py-2 text-sm font-bold text-white transition hover:border-emerald-500"
          >
            Notifications
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeTab === tab.value
                  ? "bg-emerald-500 text-black"
                  : "border border-gray-700 text-gray-300 hover:border-emerald-500"
              }`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading && <p className="mt-8 text-gray-400">Chargement...</p>}

        {!isLoading && message && (
          <p className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 text-gray-300">
            {message}
          </p>
        )}

        {!isLoading && activeTab === "upcoming" && (
          <section className="mt-8 grid gap-5">
            {upcomingActivities.length === 0 && (
              <p className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-gray-300">
                Aucune activité à venir.
              </p>
            )}

            {upcomingActivities.map((activity) => (
              <div
                key={`${activity.viewerRole}-${activity.id}`}
                className={
                  activity.viewerRole === "organizer"
                    ? "rounded-2xl border border-emerald-500/30 p-1"
                    : "rounded-2xl border border-blue-400/20 p-1"
                }
              >
                <div className="mb-2 px-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {renderRoleBadge(activity.viewerRole)}
                    <Link
                      href={`/activities/${activity.id}`}
                      className="rounded-full border border-gray-700 px-3 py-1 text-xs font-bold text-white transition hover:border-emerald-500"
                    >
                      Page privée
                    </Link>
                  </div>
                </div>
                <ActivityCard activity={activity} onSelect={setSelectedActivity} />
              </div>
            ))}

            {receivedRequests.length > 0 && (
              <section className="mt-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
                <h2 className="text-xl font-bold">Demandes reçues</h2>
                <div className="mt-4 grid gap-3">
                  {receivedRequests.map((participation) => (
                    <article
                      key={participation.id}
                      className="rounded-xl border border-gray-800 bg-gray-950 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold">
                            {participation.activity?.title || "Activité"}
                          </p>
                          {participation.activity && (
                            <p className="mt-1 text-sm text-gray-400">
                              {formatActivityDate(
                                participation.activity.activity_date
                              )}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-black"
                            onClick={() =>
                              answerRequest(participation, "accepted")
                            }
                          >
                            Accepter
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-gray-700 px-4 py-2 text-sm font-bold text-white"
                            onClick={() =>
                              answerRequest(participation, "rejected")
                            }
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}

        {!isLoading && activeTab === "requested" && (
          <section className="mt-8 grid gap-4">
            {requestedParticipations.length === 0 && (
              <p className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-gray-300">
                Aucune demande en attente.
              </p>
            )}

            {requestedParticipations.map((participation) => (
              <article
                key={participation.id}
                className="rounded-2xl border border-gray-800 bg-gray-900 p-5"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                  En attente
                </p>
                <h2 className="mt-2 text-xl font-bold">
                  {participation.activity?.title || "Activité"}
                </h2>
                {participation.activity && (
                  <p className="mt-2 text-sm text-gray-400">
                    {formatActivityDate(participation.activity.activity_date)}
                  </p>
                )}
              </article>
            ))}
          </section>
        )}

        {!isLoading && activeTab === "history" && (
          <section className="mt-8 grid gap-5">
            {historyActivities.length === 0 && (
              <p className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-gray-300">
                Aucun historique pour le moment.
              </p>
            )}

            {historyActivities.map((activity) => (
              <div key={`${activity.viewerRole}-${activity.id}`}>
                <div className="mb-2 px-3">{renderRoleBadge(activity.viewerRole)}</div>
                <ActivityCard
                  activity={activity}
                  disabled
                  disabledLabel="Terminée"
                  onSelect={setSelectedActivity}
                />
              </div>
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
