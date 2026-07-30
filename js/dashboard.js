/* ============================================================
   RESQ — Dashboard Page Script
   Two data sources feed this page:
   1) /dashboard/summary (our FastAPI backend) — stat cards and
      recent alerts, via loadDashboard()/renderSummary().
   2) Live browser geolocation + OpenStreetMap/Overpass + OpenWeatherMap
      — the interactive map, nearby-places markers, and the small
      live weather caption under the map, via loadMap()/loadNearbyPlaces()/
      loadDashboardWeather().
   Both are additive and don't conflict: the stat cards reflect the
   backend's risk/shelter/service aggregation, while the map/caption
   show a live, real-world view for the browser's current location.
   ============================================================ */

let currentLat;
let currentLon;
let routeLayer;
let dashboardMap;

const hospitalIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

const policeIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

const fireIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

const shelterIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

function loadMap(lat, lon){

    // Zoom 13 keeps a multi-km view visible by default so hospital/police/
    // fire/shelter markers from the 15km Overpass search actually appear
    // on screen instead of being zoomed past (zoom 17 only shows ~200m).
    dashboardMap = L.map("dashboardMap").setView([lat, lon], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{

        attribution:"© OpenStreetMap"

    }).addTo(dashboardMap);

    L.marker([lat, lon])

    .addTo(dashboardMap)

    .bindPopup("📍 You are here")

    .openPopup();

setTimeout(() => {
    dashboardMap.invalidateSize();
},300);
}

async function loadDashboardWeather(lat, lon){

    try{

        // Routed through our own backend's /weather/current endpoint,
        // which wraps OpenWeatherMap server-side — no API key in the
        // browser. See js/api.js -> api.getCurrentWeather().
        const res = await api.getCurrentWeather(lat, lon);
        const data = res.data;

        document.getElementById("dashboardTemp").innerText =
        Math.round(data.temperature_c) + "°C";

        document.getElementById("dashboardWeather").innerText =
        data.condition;

        document.getElementById("dashboardLocation").innerText =
        "Current Location : " + data.location;

    }

    catch(error){

        console.log(error);

    }

}

async function loadNearbyPlaces(lat, lon) {

    const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:15000,${lat},${lon});
      node["amenity"="police"](around:15000,${lat},${lon});
      node["amenity"="fire_station"](around:15000,${lat},${lon});
      node["amenity"="shelter"](around:15000,${lat},${lon});
    );
    out;
    `;

    try {

        const response = await fetch(
    `${API_BASE_URL}/nearby?lat=${lat}&lon=${lon}`
);

const data = await response.json();

        data.elements.forEach(place => {

            let markerIcon;
            let emoji = "";

            switch(place.tags.amenity){

                case "hospital":
                    markerIcon = hospitalIcon;
                    emoji = "🏥";
                    break;

                case "police":
                    markerIcon = policeIcon;
                    emoji = "🚔";
                    break;

                case "fire_station":
                    markerIcon = fireIcon;
                    emoji = "🚒";
                    break;

                case "shelter":
                    markerIcon = shelterIcon;
                    emoji = "🏠";
                    break;

                default:
                    return;

            }

            L.marker([place.lat, place.lon], {
                icon: markerIcon
            })
            .addTo(dashboardMap)
            .bindPopup(`
<b>${emoji} ${place.tags.name || place.tags.amenity}</b>

<br><br>

<button onclick="getDirections(${place.lat},${place.lon})">
🧭 Get Directions
</button>
`);

        });

    }

    catch(error){

        console.log(error);
        if (typeof api !== "undefined" && api.showToast) {
            api.showToast("Couldn't load nearby places on the map right now.", "warning");
        }

    }

}

async function getDirections(destLat,destLon){

    if(routeLayer){

        dashboardMap.removeLayer(routeLayer);

    }

    const url = `https://router.project-osrm.org/route/v1/driving/${currentLon},${currentLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
    alert("No route found.");
    return;
}

    const route = data.routes[0];
    const steps = route.legs[0].steps;

    console.log(steps);

    routeLayer = L.geoJSON(route.geometry,{
        style:{
            color:"blue",
            weight:5
        }
    }).addTo(dashboardMap);

    dashboardMap.fitBounds(routeLayer.getBounds());

    const distance =
(route.distance/1000).toFixed(2);

const time =
Math.round(route.duration/60);


    alert(
`Distance : ${distance} km

Estimated Time : ${time} min`
   );

}

// ---------- Backend-driven stat cards + alerts (/dashboard/summary) ----------

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatTimeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.max(1, Math.round(diffMs / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function renderAlerts(alerts) {
  const container = document.getElementById("recentAlertsContainer");
  document.getElementById("alertsCountBadge").innerHTML = `<span class="badge-dot"></span>${alerts.length} Active`;

  if (!alerts.length) {
    container.innerHTML = `<div class="alert-row"><div style="flex:1;"><strong>No active alerts</strong><p style="font-size:0.85rem;">You're all clear for now.</p></div></div>`;
    return;
  }

  const severityIcon = { warning: "cloud", danger: "flame", advisory: "info" };
  const severityStyle = {
    warning: "background:var(--color-warning-light); color:var(--color-warning);",
    danger: "background:#FEE2E2; color:var(--color-danger);",
    advisory: "background:var(--color-secondary-light); color:var(--color-secondary);",
  };

  container.innerHTML = alerts
    .map((a) => {
      const timeAgo = formatTimeAgo(a.created_at);
      return `
        <div class="alert-row">
          <span class="alert-icon" style="${severityStyle[a.severity] || severityStyle.advisory}">${icon(severityIcon[a.severity] || "info", 18)}</span>
          <div style="flex:1;">
            <strong>${a.title}</strong>
            <p style="font-size:0.85rem;">${a.description}</p>
          </div>
          <span class="alert-time">${timeAgo}</span>
        </div>`;
    })
    .join("");
}

function renderSummary(data) {
  document.getElementById("statWeatherValue").textContent = `${Math.round(data.weather.temperature_c)}\u00b0C`;
  document.getElementById("statWeatherLabel").textContent = `Current Weather \u00b7 ${data.weather.condition}`;

  document.getElementById("statRiskValue").textContent = data.disaster_risk.level;
  document.getElementById("statRiskLabel").textContent = `Disaster Risk \u00b7 ${data.disaster_risk.type}`;
  const riskBadge = document.getElementById("statRiskBadge");
  riskBadge.textContent = data.disaster_risk.level === "Moderate" ? "Watch" : data.disaster_risk.level;

  const nearestShelter = data.nearby_shelters[0];
  if (nearestShelter) {
    document.getElementById("statShelterValue").textContent = `${nearestShelter.distance_km} km`;
    document.getElementById("statShelterLabel").textContent = `Nearest Shelter \u00b7 ${nearestShelter.name}`;
    document.getElementById("statShelterBadge").textContent = nearestShelter.status === "open" ? "Open" : "Check status";
  }

  document.getElementById("statServicesValue").textContent = data.nearby_emergency_services.length;

  renderAlerts(data.latest_alerts);

  document.querySelectorAll(".stat-card[data-skeleton]").forEach((el) => {
    el.classList.remove("skeleton");
    el.removeAttribute("data-skeleton");
  });
}

async function loadDashboard(lat, lng) {
  try {
    const res = await api.getDashboardSummary(lat, lng);
    renderSummary(res.data);
  } catch (err) {
    api.showToast(err.message || "Couldn't load your dashboard right now.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAppShell("dashboard", "Dashboard");

  // ---- Greeting (isolated: a missing/renamed element here must not
  // block the map, weather, or stat cards below) ----
  try {
    const user = tokenStore.getUser();
    const greetingEl = document.getElementById("greetingText");
    if (greetingEl) {
      greetingEl.textContent =
        user && user.name ? `${greetingForHour()}, ${user.name.split(" ")[0]}` : greetingForHour();
    }
  } catch (err) {
    console.error("Greeting failed to render:", err);
  }

  // ---- Icon injections (isolated, and each individually null-checked) ----
  try {
    const iconMap = {
      "icon-ask-ai": ["chat", 16],
      "icon-weather-stat": ["cloud", 22],
      "icon-risk-stat": ["alertTriangle", 22],
      "icon-shelter-stat": ["tent", 22],
      "icon-services-stat": ["hospital", 22],
      "qa-upload": ["camera", 24],
      "qa-chat": ["chat", 24],
      "qa-weather": ["cloud", 24],
      "qa-shelter": ["mapPin", 24],
      "qa-guide": ["book", 24],
      "qa-services": ["hospital", 24],
    };
    Object.entries(iconMap).forEach(([id, [name, size]]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = icon(name, size);
    });
  } catch (err) {
    console.error("Icon injection failed:", err);
  }

  // ---- Backend-driven stat cards + alerts: fires immediately, does not
  // wait on the browser's geolocation permission prompt. Falls back to
  // Jaipur coordinates via getUserLocation() if location isn't available. ----
  (async () => {
    try {
      const { lat, lng } = await getUserLocation();
      await loadDashboard(lat, lng);
    } catch (err) {
      console.error("Dashboard summary failed to load:", err);
    }
  })();

  // ---- Live map + OpenWeatherMap widget + Overpass places (independent
  // of the block above — a failure here won't affect the stat cards) ----
  try {
    getCurrentLocation(function (location) {
      try {
        currentLat = location.latitude;
        currentLon = location.longitude;

        loadDashboardWeather(location.latitude, location.longitude);
        loadMap(location.latitude, location.longitude);
        loadNearbyPlaces(location.latitude, location.longitude);
      } catch (err) {
        console.error("Live map/weather widget failed:", err);
      }
    });
  } catch (err) {
    console.error("getCurrentLocation failed:", err);
  }
});
