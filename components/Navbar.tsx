export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4">

      <span className="text-emerald-400 font-bold text-2xl">
        Outmates
      </span>

      <div className="flex gap-3">

        <button className="text-sm text-gray-300 border border-gray-700 px-4 py-2 rounded-full">

          Se connecter

        </button>

        <button className="bg-emerald-500 text-black font-semibold px-4 py-2 rounded-full">

          Rejoindre

        </button>

      </div>

    </nav>
  )
}