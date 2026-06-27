export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4">
        <span className="text-emerald-400 font-bold text-2xl tracking-tight">
          Outmates
        </span>
        <div className="flex gap-3">
          <button className="text-sm text-gray-300 hover:text-white px-4 py-2 rounded-full border border-gray-700 hover:border-gray-500 transition">
            Se connecter
          </button>
          <button className="text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-full transition">
            Rejoindre
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-4">
          🏔️ Outdoor · Sport · Rencontres
        </span>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
          Breath <br />
          <span className="text-emerald-400">Together.</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-xl mb-10">
          Trouve ton prochain partenaire de rando, trail, surf ou vélo.
          Des vraies personnes, près de chez toi, pour des vraies aventures.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-4 rounded-full text-lg transition">
            Trouver un partenaire
          </button>
          <button className="border border-gray-600 hover:border-gray-400 text-white px-8 py-4 rounded-full text-lg transition">
            Voir les activités
          </button>
        </div>
      </section>

      {/* Activities */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { emoji: "🏔️", label: "Randonnée" },
            { emoji: "🏃", label: "Trail" },
            { emoji: "🚴", label: "Vélo" },
            { emoji: "🏄", label: "Surf" },
            { emoji: "🎾", label: "Tennis" },
          ].map((activity) => (
            <div
              key={activity.label}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer transition"
            >
              <span className="text-4xl">{activity.emoji}</span>
              <span className="text-gray-300 font-medium">{activity.label}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}