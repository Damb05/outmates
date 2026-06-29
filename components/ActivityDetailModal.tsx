"use client";

import { useEffect } from "react";
import {
  type Activity,
  formatActivityDate,
  GENDER_LABELS,
  LEVEL_LABELS,
  SPORT_META,
  VISIBILITY_LABELS,
} from "./ActivityCard";

type ActivityDetailModalProps = {
  activity: Activity;
  onClose: () => void;
};

export default function ActivityDetailModal({
  activity,
  onClose,
}: ActivityDetailModalProps) {
  const sport = SPORT_META[activity.sport] || {
    label: activity.sport,
    icon: "\u2B50",
  };
  const participantCount =
    activity.participants_count ?? activity.current_participants ?? 0;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-4 py-4 backdrop-blur-sm sm:items-center"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-detail-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-800 bg-gray-950 p-6 text-white shadow-2xl sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
              <span>{sport.icon}</span>
              {sport.label}
            </p>
            <h2
              id="activity-detail-title"
              className="mt-4 text-3xl font-bold tracking-tight text-white"
            >
              {activity.title}
            </h2>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-800 text-xl text-gray-300 transition hover:border-emerald-500 hover:text-white"
            onClick={onClose}
            aria-label="Fermer"
          >
            x
          </button>
        </div>

        <div className="mt-6 grid gap-3 text-sm text-gray-300 sm:grid-cols-2">
          <p className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <span className="block text-gray-500">Zone publique</span>
            {"\u{1F4CD}"} {activity.meeting_point}
          </p>
          <p className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <span className="block text-gray-500">Date</span>
            {"\u{1F4C5}"} {formatActivityDate(activity.activity_date)}
          </p>
          <p className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <span className="block text-gray-500">Niveau</span>
            {"\u2B50"} {LEVEL_LABELS[activity.level] || activity.level}
          </p>
          <p className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <span className="block text-gray-500">Participants</span>
            {"\u{1F465}"} {participantCount} / {activity.max_participants}
          </p>
          <p className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <span className="block text-gray-500">Public</span>
            {GENDER_LABELS[activity.gender_filter] || activity.gender_filter}
          </p>
          <p className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <span className="block text-gray-500">Visibilite</span>
            {"\u{1F30D}"} {VISIBILITY_LABELS[activity.visibility] || activity.visibility}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h3 className="font-bold text-white">Description</h3>
          <p className="mt-3 whitespace-pre-wrap leading-7 text-gray-300">
            {activity.description || "Aucune description pour cette activite."}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-100">
          Point precis visible uniquement aux participants acceptes
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-full border border-gray-700 px-6 py-3 font-bold text-white transition hover:border-gray-500"
            onClick={onClose}
          >
            Fermer
          </button>
          <button
            type="button"
            className="rounded-full bg-emerald-500 px-6 py-3 font-bold text-black transition hover:bg-emerald-400"
          >
            Demander a participer
          </button>
        </div>
      </section>
    </div>
  );
}
