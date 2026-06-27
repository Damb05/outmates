import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import ActivityGrid from "../components/ActivityGrid"

export default function Home() {

return (

<main className="min-h-screen bg-gray-950 text-white flex flex-col">

<Navbar/>

<Hero/>

<ActivityGrid/>

</main>

)

}