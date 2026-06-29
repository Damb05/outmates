"use client";

export type Activity = {
  id: string;
  title: string;
  sport: string;
  description: string | null;
  meeting_point: string;
  meeting_point_label: string | null;
  activity_date: string;
  latitude: number | null;
  longitude: number | null;
  level: string;
  gender_filter: string;
  max_participants: number;
  visibility: string;
  created_at: string;
  participants_count?: number | null;
  current_participants?: number | null;
};

export const SPORT_META: Record<string, { label: string; icon: string }> = {
  running: { label: "Running", icon: "\u{1F3C3}" },
  trail: { label: "Trail", icon: "\u26F0\uFE0F" },
  bike: { label: "Velo", icon: "\u{1F6B4}" },
  hiking: { label: "Randonnee", icon: "\u{1F97E}" },
  tennis: { label: "Tennis", icon: "\u{1F3BE}" },
  surf: { label: "Surf", icon: "\u{1F3C4}" },
};

export const LEVEL_LABELS: Record<string, string> = {
  debutant: "Debutant",
  initie: "Initie",
  intermediaire: "Intermediaire",
  avance: "Avance",
  expert: "Expert",
};

export const GENDER_LABELS: Record<string, string> = {
  all: "Tout le monde",
  women_only: "Femmes uniquement",
  men_only: "Hommes uniquement",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  friends: "Amis",
  private: "Prive",
};

export function formatActivityDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const time = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (date.toDateString() === now.toDateString()) {
    return `aujourd'hui - ${time}`;
  }

  if (date.toDateString() === tomorrow.toDateString()) {
    return `demain - ${time}`;
  }

  return `${date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} - ${time}`;
}

type ActivityCardProps = {
  activity: Activity;
  onSelect: (activity: Activity) => void;
};

export default function ActivityCard({ activity, onSelect }: ActivityCardProps) {
  const sport = SPORT_META[activity.sport] || {
    label: activity.sport,
    icon: "\u2B50",
  };
  const participantCount =
    activity.participants_count ?? activity.current_participants ?? 0;

  function openActivity() {
    onSelect(activity);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className="group cursor-pointer rounded-2xl border border-gray-800 bg-gray-900 p-6 transition hover:border-emerald-500 hover:bg-gray-900/90"
      onClick={openActivity}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openActivity();
        }
      }}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl">
              {sport.icon}
            </span>
            <div>
              <p className="text-sm font-medium text-emerald-300">
                {sport.label}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {activity.title}
              </h2>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="rounded-full border border-gray-700 px-5 py-2 text-sm font-bold text-white transition group-hover:border-emerald-500 group-hover:text-emerald-300"
          onClick={(event) => {
            event.stopPropagation();
            openActivity();
          }}
        >
          Voir l&apos;activite
        </button>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-gray-300 sm:grid-cols-2 lg:grid-cols-5">
        <p>{"\u{1F4CD}"} {activity.meeting_point}</p>
        <p>{"\u{1F4C5}"} {formatActivityDate(activity.activity_date)}</p>
        <p>{"\u2B50"} {LEVEL_LABELS[activity.level] || activity.level}</p>
        <p>
          {"\u{1F465}"} {participantCount} / {activity.max_participants} participants
        </p>
        <p>
          {"\u{1F30D}"} {VISIBILITY_LABELS[activity.visibility] || activity.visibility}
        </p>
      </div>
    </article>
  );
}
