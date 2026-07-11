import { supabase } from "./supabase";
import type { Activity } from "../components/ActivityCard";

export type ParticipationStatus = "pending" | "accepted" | "rejected";

export type Participation = {
  id: string;
  activity_id: string;
  user_id: string;
  status: ParticipationStatus;
  created_at: string;
  activity?: Activity;
};

export type Notification = {
  id: string;
  user_id: string;
  activity_id: string | null;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

function statusMessage(status: ParticipationStatus) {
  if (status === "pending") {
    return "Ta demande est en attente.";
  }

  if (status === "accepted") {
    return "Tu participes deja a cette activite.";
  }

  return "Ta demande a ete refusee.";
}

export async function requestToJoinActivity(activity: Activity) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      status: null,
      message: "Connecte-toi pour demander a participer.",
    };
  }

  if (activity.organizer_id && activity.organizer_id === user.id) {
    return {
      ok: false,
      status: null,
      message: "Tu es l'organisateur de cette activite.",
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("participants")
    .select("id,status")
    .eq("activity_id", activity.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      status: null,
      message: existingError.message,
    };
  }

  if (existing) {
    return {
      ok: true,
      status: existing.status as ParticipationStatus,
      message: statusMessage(existing.status as ParticipationStatus),
    };
  }

  const { data: participation, error } = await supabase
    .from("participants")
    .insert({
      activity_id: activity.id,
      user_id: user.id,
      status: "pending",
    })
    .select("id,status")
    .single();

  if (error) {
    return {
      ok: false,
      status: null,
      message: error.message,
    };
  }

  if (activity.organizer_id) {
    await supabase.from("notifications").insert({
      user_id: activity.organizer_id,
      activity_id: activity.id,
      type: "participation_requested",
      title: "Nouvelle demande",
      body: `Quelqu'un veut rejoindre ${activity.title}.`,
    });
  }

  return {
    ok: true,
    status: participation.status as ParticipationStatus,
    message: "Demande envoyee.",
  };
}

export async function answerParticipationRequest(params: {
  participation: Participation;
  status: Exclude<ParticipationStatus, "pending">;
}) {
  const { participation, status } = params;
  const { error } = await supabase
    .from("participants")
    .update({ status })
    .eq("id", participation.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  await supabase.from("notifications").insert({
    user_id: participation.user_id,
    activity_id: participation.activity_id,
    type:
      status === "accepted"
        ? "participation_accepted"
        : "participation_rejected",
    title: status === "accepted" ? "Demande acceptee" : "Demande refusee",
    body:
      status === "accepted"
        ? "Ta demande de participation a ete acceptee."
        : "Ta demande de participation a ete refusee.",
  });

  return {
    ok: true,
    message: status === "accepted" ? "Demande acceptee." : "Demande refusee.",
  };
}
