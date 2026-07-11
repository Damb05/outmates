"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatActivityDate,
  SPORT_META,
  type Activity,
} from "../../components/ActivityCard";
import { supabase } from "../../lib/supabase";

type ChatTab = "activities" | "friends";

type ActivityParticipation = {
  id: string;
  activity_id: string;
  user_id: string;
  status: "pending" | "accepted" | "rejected";
  activity?: Activity;
};

type ChatMessage = {
  id: string;
  activity_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ActivityConversation = Activity & {
  viewerRole: "organizer" | "participant";
};

const TABS: Array<{ value: ChatTab; label: string }> = [
  { value: "activities", label: "Activités" },
  { value: "friends", label: "Amis" },
];

function shortUserId(userId: string) {
  return `Membre ${userId.slice(0, 8)}`;
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeActivityConversations(
  organizedActivities: Activity[],
  acceptedParticipations: ActivityParticipation[]
) {
  const conversations = new Map<string, ActivityConversation>();

  organizedActivities.forEach((activity) => {
    conversations.set(activity.id, {
      ...activity,
      viewerRole: "organizer",
    });
  });

  acceptedParticipations.forEach((participation) => {
    if (!participation.activity || conversations.has(participation.activity.id)) {
      return;
    }

    conversations.set(participation.activity.id, {
      ...participation.activity,
      viewerRole: "participant",
    });
  });

  return [...conversations.values()].sort(
    (first, second) =>
      new Date(first.activity_date).getTime() -
      new Date(second.activity_date).getTime()
  );
}

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<ChatTab>("activities");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ActivityConversation[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const selectedActivity = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedActivityId
      ) || null,
    [conversations, selectedActivityId]
  );
  const isClosed = Boolean(selectedActivity?.closed_at);

  const fetchMessages = useCallback(async (activityId: string) => {
    setIsLoadingMessages(true);

    const { data, error } = await supabase
      .from("activity_messages")
      .select("*")
      .eq("activity_id", activityId)
      .order("created_at", { ascending: true });

    if (error) {
      setPageMessage(error.message);
      setMessages([]);
    } else {
      setMessages((data || []) as ChatMessage[]);
    }

    setIsLoadingMessages(false);
  }, []);

  const fetchConversations = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id || null);
    setPageMessage("");

    if (!user) {
      setPageMessage("Connecte-toi pour voir tes discussions.");
      setIsLoading(false);
      return;
    }

    const [organizedResult, acceptedResult] = await Promise.all([
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
    ]);

    if (organizedResult.error || acceptedResult.error) {
      setPageMessage(
        organizedResult.error?.message ||
          acceptedResult.error?.message ||
          "Impossible de charger les discussions."
      );
      setIsLoading(false);
      return;
    }

    const nextConversations = mergeActivityConversations(
      (organizedResult.data || []) as Activity[],
      (acceptedResult.data || []) as ActivityParticipation[]
    );

    setConversations(nextConversations);
    setSelectedActivityId((currentActivityId) => {
      if (
        currentActivityId &&
        nextConversations.some(
          (conversation) => conversation.id === currentActivityId
        )
      ) {
        return currentActivityId;
      }

      return nextConversations[0]?.id || null;
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchConversations();
    });
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedActivityId) {
      queueMicrotask(() => {
        setMessages([]);
      });
      return;
    }

    queueMicrotask(() => {
      fetchMessages(selectedActivityId);
    });
  }, [fetchMessages, selectedActivityId]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();

    if (!currentUserId || !selectedActivity || !messageBody.trim() || isClosed) {
      return;
    }

    setIsSending(true);
    setPageMessage("");

    const { error } = await supabase.from("activity_messages").insert({
      activity_id: selectedActivity.id,
      user_id: currentUserId,
      body: messageBody.trim(),
    });

    if (error) {
      setPageMessage(error.message);
    } else {
      setMessageBody("");
      await fetchMessages(selectedActivity.id);
    }

    setIsSending(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">
              Outmates
            </p>
            <h1 className="mt-3 text-4xl font-bold">Chat</h1>
          </div>

          <Link
            href="/you"
            className="rounded-full border border-gray-700 px-4 py-2 text-sm font-bold text-white transition hover:border-emerald-500"
          >
            Vous
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

        {pageMessage && (
          <p className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 text-gray-300">
            {pageMessage}
          </p>
        )}

        {activeTab === "friends" && (
          <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-8">
            <h2 className="text-2xl font-bold">Chats amis</h2>
            <p className="mt-3 text-gray-400">
              Les conversations avec les amis arriveront avec la brique réseau.
            </p>
          </section>
        )}

        {activeTab === "activities" && (
          <section className="mt-8 grid min-h-[640px] overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 lg:grid-cols-[340px_1fr]">
            <aside className="border-b border-gray-800 lg:border-b-0 lg:border-r">
              <div className="border-b border-gray-800 p-5">
                <h2 className="font-bold">Discussions d&apos;activités</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Activités organisées ou acceptées.
                </p>
              </div>

              {isLoading && (
                <p className="p-5 text-sm text-gray-500">Chargement...</p>
              )}

              {!isLoading && conversations.length === 0 && (
                <p className="p-5 text-sm text-gray-500">
                  Aucun chat d&apos;activité disponible.
                </p>
              )}

              {conversations.length > 0 && (
                <div className="max-h-[560px] overflow-y-auto">
                  {conversations.map((conversation) => {
                    const sport = SPORT_META[conversation.sport] || {
                      label: conversation.sport,
                      icon: "\u2B50",
                    };
                    const isSelected = conversation.id === selectedActivityId;

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        className={`flex w-full gap-3 border-b border-gray-800 p-4 text-left transition ${
                          isSelected
                            ? "bg-emerald-500/10"
                            : "hover:bg-gray-950/70"
                        }`}
                        onClick={() => setSelectedActivityId(conversation.id)}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-xl">
                          {sport.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-white">
                            {conversation.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-gray-500">
                            {formatActivityDate(conversation.activity_date)}
                          </span>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              conversation.viewerRole === "organizer"
                                ? "bg-emerald-500 text-black"
                                : "border border-blue-400/50 text-blue-200"
                            }`}
                          >
                            {conversation.viewerRole === "organizer"
                              ? "Organisateur"
                              : "Participant"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <div className="flex min-h-[640px] flex-col">
              {!selectedActivity && (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-500">
                  Sélectionne une discussion.
                </div>
              )}

              {selectedActivity && (
                <>
                  <Link
                    href={`/activities/${selectedActivity.id}`}
                    className="flex items-center justify-between gap-4 border-b border-gray-800 bg-gray-950 px-5 py-4 transition hover:bg-gray-950/70"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white">
                        {selectedActivity.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-gray-500">
                        Voir la page complète de l&apos;activité
                      </span>
                    </span>
                    {isClosed && (
                      <span className="rounded-full border border-amber-400/50 px-3 py-1 text-xs font-bold text-amber-100">
                        Archivé
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
                    {isLoadingMessages && (
                      <p className="text-sm text-gray-500">Chargement...</p>
                    )}

                    {!isLoadingMessages && messages.length === 0 && (
                      <p className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-sm text-gray-500">
                        Aucun message dans cette discussion.
                      </p>
                    )}

                    {!isLoadingMessages &&
                      messages.map((message) => {
                        const isMine = message.user_id === currentUserId;

                        return (
                          <article
                            key={message.id}
                            className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                              isMine
                                ? "ml-auto bg-emerald-500 text-black"
                                : "bg-gray-800 text-white"
                            }`}
                          >
                            <p className="text-sm font-semibold">
                              {isMine ? "Vous" : shortUserId(message.user_id)}
                            </p>
                            <p className="mt-1 text-sm leading-6">
                              {message.body}
                            </p>
                            <p
                              className={`mt-2 text-right text-[11px] ${
                                isMine ? "text-black/60" : "text-gray-500"
                              }`}
                            >
                              {formatMessageTime(message.created_at)}
                            </p>
                          </article>
                        );
                      })}
                  </div>

                  <form
                    onSubmit={sendMessage}
                    className="flex gap-2 border-t border-gray-800 p-4"
                  >
                    <input
                      className="min-w-0 flex-1 rounded-full border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder={
                        isClosed ? "Chat archivé" : "Écrire un message..."
                      }
                      value={messageBody}
                      disabled={isClosed}
                      onChange={(event) => setMessageBody(event.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={isSending || isClosed || !messageBody.trim()}
                      className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Envoyer
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
