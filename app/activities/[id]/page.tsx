"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatActivityDate,
  GENDER_LABELS,
  LEVEL_LABELS,
  SPORT_META,
  type Activity,
} from "../../../components/ActivityCard";
import { requestToJoinActivity } from "../../../lib/participation";
import { supabase } from "../../../lib/supabase";

type ParticipantRow = {
  id: string;
  activity_id: string;
  user_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type ChatMessage = {
  id: string;
  activity_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

function shortUserId(userId: string) {
  return `Membre ${userId.slice(0, 8)}`;
}

function formatMessageDate(value: string) {
  const date = new Date(value);

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityPrivatePage() {
  const params = useParams<{ id: string }>();
  const activityId = params.id;
  const [activity, setActivity] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const acceptedParticipants = useMemo(
    () => participants.filter((participant) => participant.status === "accepted"),
    [participants]
  );
  const isOrganizer =
    Boolean(currentUserId) && activity?.organizer_id === currentUserId;
  const isAcceptedParticipant =
    Boolean(currentUserId) &&
    acceptedParticipants.some(
      (participant) => participant.user_id === currentUserId
    );
  const hasPrivateAccess = Boolean(isOrganizer || isAcceptedParticipant);
  const isClosed = Boolean(activity?.closed_at);
  const sport = activity
    ? SPORT_META[activity.sport] || { label: activity.sport, icon: "\u2B50" }
    : null;

  const fetchActivityPage = useCallback(async () => {
    if (!activityId) {
      return;
    }

    setIsLoading(true);
    setPageMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    const { data: activityData, error: activityError } = await supabase
      .from("activities")
      .select("*")
      .eq("id", activityId)
      .single();

    if (activityError || !activityData) {
      setPageMessage(activityError?.message || "Activité introuvable.");
      setIsLoading(false);
      return;
    }

    setActivity(activityData as Activity);

    const { data: participantData, error: participantError } = await supabase
      .from("participants")
      .select("*")
      .eq("activity_id", activityId)
      .order("created_at", { ascending: true });

    if (participantError) {
      setPageMessage(participantError.message);
      setIsLoading(false);
      return;
    }

    const nextParticipants = (participantData || []) as ParticipantRow[];
    setParticipants(nextParticipants);

    const userHasAccess =
      activityData.organizer_id === user?.id ||
      nextParticipants.some(
        (participant) =>
          participant.user_id === user?.id && participant.status === "accepted"
      );

    if (userHasAccess) {
      const { data: messageData, error: messageError } = await supabase
        .from("activity_messages")
        .select("*")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: true });

      if (messageError) {
        setPageMessage(messageError.message);
      } else {
        setMessages((messageData || []) as ChatMessage[]);
      }
    }

    setIsLoading(false);
  }, [activityId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchActivityPage();
    });
  }, [fetchActivityPage]);

  async function handleRequestJoin() {
    if (!activity) {
      return;
    }

    const result = await requestToJoinActivity(activity);
    setAccessMessage(result.message);

    if (result.ok) {
      await fetchActivityPage();
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();

    if (!currentUserId || !activity || !chatBody.trim() || isClosed) {
      return;
    }

    setIsSending(true);

    const { error } = await supabase.from("activity_messages").insert({
      activity_id: activity.id,
      user_id: currentUserId,
      body: chatBody.trim(),
    });

    if (error) {
      setPageMessage(error.message);
    } else {
      setChatBody("");
      await fetchActivityPage();
    }

    setIsSending(false);
  }

  async function closeActivity() {
    if (!activity || !isOrganizer) {
      return;
    }

    const closedAt = new Date().toISOString();
    const { error } = await supabase
      .from("activities")
      .update({ closed_at: closedAt })
      .eq("id", activity.id);

    if (error) {
      setPageMessage(error.message);
      return;
    }

    setActivity({ ...activity, closed_at: closedAt });
    setPageMessage("Activité clôturée. Le chat est maintenant archivé.");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
        <p className="mx-auto max-w-5xl text-gray-400">Chargement...</p>
      </main>
    );
  }

  if (!activity || pageMessage === "Activité introuvable.") {
    return (
      <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-gray-300">{pageMessage || "Activité introuvable."}</p>
          <Link
            href="/activities"
            className="mt-5 inline-flex rounded-full bg-emerald-500 px-5 py-3 font-bold text-black"
          >
            Retour aux activités
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <Link
            href="/activities"
            className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Retour aux activités
          </Link>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {sport && (
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
                  <span>{sport.icon}</span>
                  {sport.label}
                </p>
              )}
              <h1 className="mt-4 text-4xl font-bold">{activity.title}</h1>
              <p className="mt-3 text-gray-400">
                {activity.description || "Aucune description pour cette activité."}
              </p>
            </div>

            {isOrganizer && !isClosed && (
              <button
                type="button"
                className="rounded-full border border-amber-400/50 px-5 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-400/10"
                onClick={closeActivity}
              >
                Clôturer
              </button>
            )}
          </div>

          {isClosed && (
            <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Activité clôturée. Le chat est archivé.
            </p>
          )}

          <div className="mt-6 grid gap-3 text-sm text-gray-300 sm:grid-cols-2">
            <p className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <span className="block text-gray-500">Date</span>
              {"\u{1F4C5}"} {formatActivityDate(activity.activity_date)}
            </p>
            <p className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <span className="block text-gray-500">Zone publique</span>
              {"\u{1F4CD}"} {activity.meeting_point}
            </p>
            <p className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <span className="block text-gray-500">Niveau</span>
              {"\u2B50"} {LEVEL_LABELS[activity.level] || activity.level}
            </p>
            <p className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <span className="block text-gray-500">Public</span>
              {GENDER_LABELS[activity.gender_filter] || activity.gender_filter}
            </p>
          </div>

          {!hasPrivateAccess && (
            <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <h2 className="text-xl font-bold">Accès privé verrouillé</h2>
              <p className="mt-2 text-gray-400">
                Le point précis, la liste des participants et le chat sont
                visibles après acceptation par l&apos;organisateur.
              </p>
              <button
                type="button"
                className="mt-5 rounded-full bg-emerald-500 px-6 py-3 font-bold text-black transition hover:bg-emerald-400"
                onClick={handleRequestJoin}
              >
                Demander à participer
              </button>
              {accessMessage && (
                <p className="mt-4 text-sm text-emerald-300">{accessMessage}</p>
              )}
            </div>
          )}

          {hasPrivateAccess && (
            <div className="mt-6 grid gap-4">
              <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <h2 className="font-bold text-emerald-100">Point précis</h2>
                <p className="mt-2 text-emerald-50">
                  {activity.meeting_point_label || activity.meeting_point}
                </p>
              </section>

              <section className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                <h2 className="font-bold">
                  Participants acceptés ({acceptedParticipants.length} /{" "}
                  {activity.max_participants})
                </h2>
                {acceptedParticipants.length === 0 && (
                  <p className="mt-3 text-sm text-gray-500">
                    Aucun participant accepté pour le moment.
                  </p>
                )}
                {acceptedParticipants.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {acceptedParticipants.map((participant) => (
                      <p
                        key={participant.id}
                        className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-300"
                      >
                        {shortUserId(participant.user_id)}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {pageMessage && pageMessage !== "Activité introuvable." && (
            <p className="mt-5 rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-300">
              {pageMessage}
            </p>
          )}
        </section>

        <aside className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Chat activité</h2>
              <p className="mt-1 text-sm text-gray-500">
                {hasPrivateAccess
                  ? "Ouvert aux participants acceptés et à l'organisateur."
                  : "Disponible après acceptation."}
              </p>
            </div>
          </div>

          {!hasPrivateAccess && (
            <p className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-5 text-gray-400">
              Tu verras le chat ici quand ta demande sera acceptée.
            </p>
          )}

          {hasPrivateAccess && (
            <>
              <div className="mt-6 flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-2xl border border-gray-800 bg-gray-950 p-4">
                {messages.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Aucun message pour le moment.
                  </p>
                )}

                {messages.map((message) => {
                  const isMine = message.user_id === currentUserId;

                  return (
                    <article
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        isMine
                          ? "ml-auto bg-emerald-500 text-black"
                          : "bg-gray-800 text-white"
                      }`}
                    >
                      <p className="text-sm font-semibold">
                        {isMine ? "Vous" : shortUserId(message.user_id)}
                      </p>
                      <p className="mt-1 text-sm">{message.body}</p>
                      <p
                        className={`mt-2 text-right text-[11px] ${
                          isMine ? "text-black/60" : "text-gray-500"
                        }`}
                      >
                        {formatMessageDate(message.created_at)}
                      </p>
                    </article>
                  );
                })}
              </div>

              <form onSubmit={sendMessage} className="mt-4 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-full border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder={
                    isClosed ? "Chat archivé" : "Écrire un message..."
                  }
                  value={chatBody}
                  disabled={isClosed}
                  onChange={(event) => setChatBody(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={isSending || isClosed || !chatBody.trim()}
                  className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Envoyer
                </button>
              </form>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
