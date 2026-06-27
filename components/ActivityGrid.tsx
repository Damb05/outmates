const activities = [

{emoji:"🏔️",label:"Randonnée"},

{emoji:"🏃",label:"Trail"},

{emoji:"🚴",label:"Vélo"},

{emoji:"🏄",label:"Surf"},

{emoji:"🎾",label:"Tennis"}

]

export default function ActivityGrid(){

return(

<section className="px-6 pb-16">

<div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">

{activities.map(activity=>(

<div

key={activity.label}

className="bg-gray-900 rounded-2xl p-6 flex flex-col items-center border border-gray-800"

>

<span className="text-4xl">

{activity.emoji}

</span>

<span className="mt-2">

{activity.label}

</span>

</div>

))}

</div>

</section>

)

}