/* ============================================================
   RESQ — Shelter Finder Page Script
   Live shelter data via OpenStreetMap/Overpass, rendered on a
   Leaflet map with matching cards in #nearbyShelterCards.
   Uses the shared getCurrentLocation() helper from common.js.
   ============================================================ */
let shelterMap;
let currentLat;
let currentLon;
let routeLayer;
let shelterMarkers = [];
let shelterLayer = [];

const shelterIcon = new L.Icon({

    iconUrl:"https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",

    shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",

    iconSize:[25,41],

    iconAnchor:[12,41],

    popupAnchor:[1,-34]

});

async function loadNearbyShelters(lat,lon){

const query = `
[out:json][timeout:25];
(
    node["amenity"="shelter"](around:15000,${lat},${lon});
    node["amenity"="community_centre"](around:15000,${lat},${lon});
    node["amenity"="townhall"](around:15000,${lat},${lon});
);
out;
`;

try{

const response = await fetch(`${API_BASE_URL}/nearby?lat=${lat}&lon=${lon}&type=shelter`)


if (!response.ok) {
    throw new Error("Failed to load nearby shelters");
}

const data = await response.json();

console.log("Total Shelters:", data.elements.length);
console.log(data.elements);

if (data.elements.length === 0) {
    document.getElementById("nearbyShelterCards").innerHTML =
        `<div class="card"><p>No shelters found nearby via OpenStreetMap data. Try a different area.</p></div>`;
    return;
}


data.elements.forEach(place=>{

const marker = L.marker([place.lat, place.lon], {
    icon: shelterIcon
}).addTo(shelterMap);
shelterLayer.push(marker);
console.log(place.tags);
shelterMarkers.push({

    marker: marker,

    name: (place.tags.name || "").toLowerCase(),

    area: (
        place.tags["addr:suburb"] ||
        place.tags["addr:city"] ||
        place.tags["addr:district"] ||
        ""
    ).toLowerCase(),

    data: place

});
console.log({
    name: place.tags.name,
    suburb: place.tags["addr:suburb"],
    city: place.tags["addr:city"],
    district: place.tags["addr:district"]
});

marker.on("click", function () {

    updateShelterCard(
        place.tags.name || "Emergency Shelter",
        "Emergency Shelter"
    );

});

marker.bindPopup(`

<b>🏠 ${place.tags.name || "Shelter"}</b>

<br><br>

Emergency Shelter

<br><br>

<button onclick="getDirections(${place.lat},${place.lon})">

🧭 Get Directions

</button>

`);


const card = document.createElement("div");

card.className = "card place-card";

card.innerHTML = `
<div class="place-info">

<span class="place-icon">🏠</span>

<div>

<h4>${place.tags.name || "Emergency Shelter"}</h4>

<p>Emergency Shelter</p>

</div>

</div>

<div class="place-actions">

<button class="icon-btn-outline" type="button" aria-label="Get directions to ${(place.tags.name || "this shelter").replace(/"/g, "&quot;")}">
🧭
</button>

</div>
`;

card.querySelector(".icon-btn-outline").addEventListener("click", () => {
    getDirections(place.lat, place.lon);
});

card.addEventListener("click", (e) => {
    if (e.target.closest(".icon-btn-outline")) return;
    shelterMap.setView(marker.getLatLng(), 17);
    marker.openPopup();
    updateShelterCard(place.tags.name || "Emergency Shelter", "Emergency Shelter");
});

document
    .getElementById("nearbyShelterCards")
    .appendChild(card);
});
}

catch(error){

console.log(error);
document.getElementById("nearbyShelterCards").innerHTML =
    `<div class="card"><p>Couldn't load nearby shelters right now &mdash; the map data service may be busy. Please try again in a moment.</p></div>`;
if (typeof api !== "undefined" && api.showToast) {
    api.showToast("Couldn't load nearby shelters. Please try again.", "error");
}

}
   }




function loadMap(lat, lon){
  

    shelterMap = L.map("shelterMap").setView([lat, lon], 15);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "© OpenStreetMap"
        }
    ).addTo(shelterMap);

    L.marker([lat, lon])
        .addTo(shelterMap)
        .bindPopup("📍 You are here")
        .openPopup();

}
function updateShelterCard(name, type) {

    document.getElementById("shelterDetails").innerHTML = `

        <h2>🏠 Shelter Details</h2>

        <hr>

        <h3>${name}</h3>

        <p><b>Type :</b> ${type}</p>

        <p>Click "Get Directions" to see route details.</p>

    `;

}
function searchShelter() {

    const input = document
        .getElementById("searchInput")
        .value
        .trim()
        .toLowerCase();

    if (input === "") {
        alert("Please enter a shelter name.");
        return;
    }

    const result = shelterMarkers.find(item =>

    item.name.includes(input) ||

    item.area.includes(input)

);

    if (!result) {
        alert("Shelter not found.");
        return;
    }

    shelterMap.setView(
        result.marker.getLatLng(),
        17
    );

    result.marker.openPopup();
    updateShelterCard(
    result.data.tags.name || "Emergency Shelter",
    "Emergency Shelter"
);

}
async function getDirections(destLat, destLon) {

    if (routeLayer) {
        shelterMap.removeLayer(routeLayer);
    }

    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${currentLon},${currentLat};${destLon},${destLat}` +
        `?overview=full&geometries=geojson`;

    try {

        const response = await fetch(url);
        const data = await response.json();

        const route = data.routes[0];

        const coords = route.geometry.coordinates.map(coord => [
            coord[1],
            coord[0]
        ]);

        routeLayer = L.polyline(coords, {
            color: "blue",
            weight: 6
        }).addTo(shelterMap);

        shelterMap.fitBounds(routeLayer.getBounds());

        const distance = (route.distance / 1000).toFixed(2);
        const time = Math.round(route.duration / 60);

        alert(
            `Distance : ${distance} km\nTime : ${time} min`
        );

    }

    catch (error) {

        console.log(error);

    }

}
document.addEventListener("DOMContentLoaded", () => {
  initAppShell("shelter", "Shelter Finder");
  getCurrentLocation(function(location){

currentLat=location.latitude;
currentLon=location.longitude;

loadMap(
location.latitude,
location.longitude
);


loadNearbyShelters(
location.latitude,
location.longitude

);

});

  document.getElementById("locIcon").innerHTML = icon("location", 16);
  document.getElementById("searchIcon").innerHTML = icon("search", 16);

  document
    .getElementById("searchBtn")
    .addEventListener("click", searchShelter);
    document
.getElementsByClassName("location-btn")[0]
.addEventListener("click", function () {

    getCurrentLocation(function(location){

        currentLat = location.latitude;
        currentLon = location.longitude;

        shelterMap.setView(
            [currentLat, currentLon],
            15
        );

        // Remove old shelter markers
        shelterLayer.forEach(marker => {
            shelterMap.removeLayer(marker);
        });

        shelterLayer = [];

        shelterMarkers = [];

        document.getElementById("nearbyShelterCards").innerHTML = "";

        if(routeLayer){
            shelterMap.removeLayer(routeLayer);
        }

        loadNearbyShelters(currentLat, currentLon);

    });

});


  });
