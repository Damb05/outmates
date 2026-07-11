"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  pseudo: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { href: "/activities", label: "Activités", icon: "⌁" },
  { href: "/map", label: "Carte", icon: "◎" },
  { href: "/you", label: "Vous", icon: "◔" },
  { href: "/chat", label: "Chat", icon: "✉" },
  { href: "/notifications", label: "Notifs", icon: "●" },
];

function getMetadataPseudo(user: User | null) {
  const pseudo = user?.user_metadata?.pseudo;

  return typeof pseudo === "string" && pseudo.trim() ? pseudo.trim() : "";
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = useMemo(() => {
    return (
      profile?.pseudo?.trim() ||
      getMetadataPseudo(user) ||
      user?.email ||
      "Login"
    );
  }, [profile, user]);

  async function loadProfile(currentUser: User | null) {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (!error) {
      setProfile((data || null) as Profile | null);
    }
  }

  useEffect(() => {
    queueMicrotask(async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);
      await loadProfile(currentUser);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(async () => {
        setUser(session?.user || null);
        await loadProfile(session?.user || null);
        setIsAuthLoading(false);
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsSigningOut(false);
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const authControl = user ? (
    <div className="flex items-center gap-2">
      <Link
        href="/you"
        className="inline-flex min-w-0 max-w-48 items-center gap-2 rounded-full border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:border-emerald-500"
        title={displayName}
      >
        <span aria-hidden="true">◔</span>
        <span className="truncate">{displayName}</span>
      </Link>
      <button
        type="button"
        className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSigningOut}
        onClick={handleSignOut}
      >
        {isSigningOut ? "..." : "Déconnexion"}
      </button>
    </div>
  ) : (
    <Link
      href="/login"
      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
    >
      <span aria-hidden="true">◔</span>
      Login
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b border-gray-900 bg-gray-950/95 backdrop-blur md:block">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-emerald-400">
            Outmates
          </Link>

          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  isActive(item.href)
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                    : "border-gray-700 text-gray-300 hover:border-emerald-500 hover:text-white"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="min-w-36">
            {!isAuthLoading && authControl}
            {isAuthLoading && (
              <span className="block h-10 rounded-full border border-gray-800 bg-gray-900" />
            )}
          </div>
        </nav>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-800 bg-gray-950/95 px-2 pb-2 pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition ${
                isActive(item.href)
                  ? "bg-emerald-500 text-black"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {item.icon}
              </span>
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          ))}

          {user ? (
            <button
              type="button"
              className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium text-gray-400 transition hover:bg-gray-900 hover:text-white"
              disabled={isSigningOut}
              onClick={handleSignOut}
              title={displayName}
            >
              <span aria-hidden="true" className="text-base leading-none">
                ◔
              </span>
              <span className="w-full truncate text-center">
                {isSigningOut ? "..." : displayName}
              </span>
            </button>
          ) : (
            <Link
              href="/login"
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition ${
                isActive("/login")
                  ? "bg-emerald-500 text-black"
                  : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                ◔
              </span>
              <span className="w-full truncate text-center">Login</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
