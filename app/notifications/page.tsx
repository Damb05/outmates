"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Notification } from "../../lib/participation";

function formatNotificationDate(value: string) {
  const date = new Date(value);

  return `${date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} à ${date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Connecte-toi pour voir tes notifications.");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setNotifications((data || []) as Notification[]);
      }

      setIsLoading(false);
    }

    fetchNotifications();
  }, []);

  async function markAsRead(notificationId: string) {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notificationId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: readAt }
          : notification
      )
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">
              Outmates
            </p>
            <h1 className="mt-3 text-4xl font-bold">Notifications</h1>
          </div>

          <Link
            href="/you"
            className="rounded-full border border-gray-700 px-4 py-2 text-sm font-bold text-white transition hover:border-emerald-500"
          >
            Vous
          </Link>
        </div>

        {isLoading && <p className="mt-8 text-gray-400">Chargement...</p>}

        {!isLoading && message && (
          <p className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-5 text-gray-300">
            {message}
          </p>
        )}

        {!isLoading && !message && notifications.length === 0 && (
          <p className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-5 text-gray-300">
            Aucune notification pour le moment.
          </p>
        )}

        {notifications.length > 0 && (
          <section className="mt-8 grid gap-3">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-2xl border p-5 ${
                  notification.read_at
                    ? "border-gray-800 bg-gray-900/60"
                    : "border-emerald-500/40 bg-emerald-500/10"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-bold text-white">
                      {notification.title}
                    </h2>
                    <p className="mt-2 text-sm text-gray-300">
                      {notification.body}
                    </p>
                    <p className="mt-3 text-xs text-gray-500">
                      {formatNotificationDate(notification.created_at)}
                    </p>
                  </div>

                  {!notification.read_at && (
                    <button
                      type="button"
                      className="rounded-full border border-gray-700 px-4 py-2 text-sm font-bold text-white transition hover:border-emerald-500"
                      onClick={() => markAsRead(notification.id)}
                    >
                      Marquer lue
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
