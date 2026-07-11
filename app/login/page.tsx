"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = mode === "login";

  useEffect(() => {
    queueMicrotask(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace("/you");
      }
    });
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setErrorMessage("");

    const credentials = {
      email: email.trim(),
      password,
    };

    const { data, error } = isLogin
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp({
          ...credentials,
          options: {
            data: {
              pseudo: pseudo.trim(),
            },
          },
        });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    if (!isLogin && data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        pseudo: pseudo.trim(),
      });
    }

    if (data.session || (isLogin && data.user)) {
      router.replace("/you");
      return;
    }

    setMessage(
      "Compte créé. Vérifie tes emails si Supabase demande une confirmation."
    );
    setIsSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl sm:p-8">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400"
          >
            Outmates
          </Link>

          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            {isLogin ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            {isLogin
              ? "Connecte-toi pour gérer tes activités, tes demandes et tes discussions."
              : "Inscris-toi pour rejoindre des activités et organiser tes sorties."}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-full border border-gray-800 bg-gray-950 p-1">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                isLogin ? "bg-emerald-500 text-black" : "text-gray-400"
              }`}
              onClick={() => {
                setMode("login");
                setMessage("");
                setErrorMessage("");
              }}
            >
              Connexion
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                !isLogin ? "bg-emerald-500 text-black" : "text-gray-400"
              }`}
              onClick={() => {
                setMode("signup");
                setMessage("");
                setErrorMessage("");
              }}
            >
              Inscription
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!isLogin && (
              <label className="block">
                <span className="text-sm font-medium text-gray-300">
                  Pseudo
                </span>
                <input
                  type="text"
                  required
                  minLength={2}
                  autoComplete="nickname"
                  className="mt-2 w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500"
                  placeholder="Ton pseudo Outmates"
                  value={pseudo}
                  onChange={(event) => setPseudo(event.target.value)}
                />
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-300">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500"
                placeholder="toi@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-300">
                Mot de passe
              </span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="mt-2 w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500"
                placeholder="6 caractères minimum"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {errorMessage && (
              <p className="rounded-xl border border-red-900/70 bg-red-950/50 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            )}

            {message && (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-emerald-500 px-6 py-4 font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Patiente..."
                : isLogin
                  ? "Se connecter"
                  : "Créer le compte"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
