from fastapi import APIRouter, Query
import httpx

router = APIRouter(prefix="/nearby", tags=["Nearby"])

@router.get("/")
async def get_nearby(
    lat: float = Query(...),
    lon: float = Query(...),
    type: str = Query("all")
):
    if type == "shelter":
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="shelter"](around:15000,{lat},{lon});
          node["amenity"="community_centre"](around:15000,{lat},{lon});
          node["amenity"="townhall"](around:15000,{lat},{lon});
        );
        out;
        """
    else:
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:15000,{lat},{lon});
          node["amenity"="police"](around:15000,{lat},{lon});
          node["amenity"="fire_station"](around:15000,{lat},{lon});
          node["amenity"="shelter"](around:15000,{lat},{lon});
        );
        out;
        """

    url = "https://overpass-api.de/api/interpreter"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            url,
            params={"data": query},
            headers={"User-Agent": "ResQ/1.0"},
        )

    response.raise_for_status()
    return response.json()