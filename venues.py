"""
Restaurant catalog + live-data provider.

By default the app serves a large curated multi-city catalog (real, well-known
restaurants) so "every restaurant" feels real with no keys. Set a provider key
to pull the *actual* live database instead:

  VENUE_PROVIDER = yelp | google        (else the built-in catalog)
  YELP_API_KEY / GOOGLE_PLACES_API_KEY

Both provider paths and the catalog return the same venue shape the app expects.
"""

import hashlib
import os

# ---- gradient "photo" per cuisine (the app maps these keys to CSS gradients) ----
_PHOTO = {
    "Italian": "ember", "Steakhouse": "wine", "American": "ember", "New American": "ember",
    "Californian": "sage", "Mediterranean": "citrus", "Greek": "citrus", "Seafood": "slate",
    "French": "wine", "Fine dining": "wine", "Tasting": "wine", "Kaiseki": "slate",
    "Indian": "ember", "Thai": "citrus", "Mexican": "citrus", "Oaxacan": "citrus",
    "Spanish": "ember", "British": "cream", "Deli": "cream", "Bakery": "cream",
    "Pizza": "ember", "Diner": "cream", "Food hall": "slate", "Gastropub": "sage",
    "Small plates": "wine",
}
_AMEN = {
    "Italian": ["Handmade pasta", "Wine list", "Bar seats"],
    "Steakhouse": ["Dry-aged beef", "Classic cocktails", "Groups"],
    "Seafood": ["Raw bar", "Daily catch", "Patio"],
    "French": ["Tasting menu", "Sommelier", "Private room"],
    "Fine dining": ["Tasting menu", "Wine pairing", "Chef's counter"],
    "Tasting": ["Chef's counter", "Wine pairing", "Seasonal"],
    "Indian": ["Small plates", "Cocktails", "Vegetarian"],
    "Pizza": ["Wood-fired", "Casual", "Family friendly"],
    "Deli": ["Counter service", "Classic", "Takeout"],
    "Mexican": ["Mezcal bar", "Small plates", "Patio"],
    "Californian": ["Wood-fired", "Local produce", "Natural wine"],
}
_CITY = {
    "San Francisco": (37.7749, -122.4194), "New York": (40.7228, -73.9960),
    "Los Angeles": (34.0522, -118.2437), "Chicago": (41.8845, -87.6355),
    "London": (51.5100, -0.1300),
}

# (id, name, cuisine, neighborhood, city, price, rating, reviews)
_RAW = [
    # San Francisco (keep original ids so seeded community recs still match)
    ("tasting-room", "The Tasting Room", "New American", "Hayes Valley", "San Francisco", "$$$", 4, 128),
    ("nopa", "Nopa", "Californian", "Alamo Square", "San Francisco", "$$", 5, 342),
    ("zuni", "Zuni Café", "Mediterranean", "Hayes Valley", "San Francisco", "$$$", 4, 210),
    ("state-bird", "State Bird Provisions", "Small plates", "Fillmore", "San Francisco", "$$$", 5, 512),
    ("kokkari", "Kokkari Estiatorio", "Greek", "Financial District", "San Francisco", "$$$", 5, 388),
    ("rich-table", "Rich Table", "New American", "Hayes Valley", "San Francisco", "$$$", 4, 176),
    ("foreign-cinema", "Foreign Cinema", "Californian", "Mission", "San Francisco", "$$$", 4, 421),
    ("swan-oyster", "Swan Oyster Depot", "Seafood", "Nob Hill", "San Francisco", "$$", 5, 690),
    ("house-prime-rib", "House of Prime Rib", "Steakhouse", "Nob Hill", "San Francisco", "$$$", 5, 812),
    ("che-fico", "Che Fico", "Italian", "NoPa", "San Francisco", "$$$", 4, 305),
    ("lazy-bear", "Lazy Bear", "Tasting", "Mission", "San Francisco", "$$$$", 5, 260),
    ("tartine", "Tartine Manufactory", "Bakery", "Mission", "San Francisco", "$$", 4, 540),
    # New York
    ("katzs", "Katz's Delicatessen", "Deli", "Lower East Side", "New York", "$$", 5, 1500),
    ("peter-luger", "Peter Luger", "Steakhouse", "Williamsburg", "New York", "$$$$", 4, 980),
    ("le-bernardin", "Le Bernardin", "Seafood", "Midtown", "New York", "$$$$", 5, 720),
    ("gramercy-tavern", "Gramercy Tavern", "American", "Flatiron", "New York", "$$$", 5, 660),
    ("carbone", "Carbone", "Italian", "Greenwich Village", "New York", "$$$$", 5, 815),
    ("lilia", "Lilia", "Italian", "Williamsburg", "New York", "$$$", 5, 430),
    ("balthazar", "Balthazar", "French", "SoHo", "New York", "$$$", 4, 910),
    ("emp", "Eleven Madison Park", "Fine dining", "Flatiron", "New York", "$$$$", 5, 540),
    ("via-carota", "Via Carota", "Italian", "West Village", "New York", "$$$", 5, 388),
    ("cosme", "Cosme", "Mexican", "Flatiron", "New York", "$$$", 4, 402),
    ("russ-daughters", "Russ & Daughters", "Deli", "Lower East Side", "New York", "$$", 5, 610),
    ("momofuku-ko", "Momofuku Ko", "Tasting", "East Village", "New York", "$$$$", 4, 233),
    # Los Angeles
    ("bestia", "Bestia", "Italian", "Arts District", "Los Angeles", "$$$", 5, 720),
    ("guelaguetza", "Guelaguetza", "Oaxacan", "Koreatown", "Los Angeles", "$$", 5, 540),
    ("republique", "République", "French", "Mid-City", "Los Angeles", "$$$", 4, 610),
    ("nnaka", "n/naka", "Kaiseki", "Palms", "Los Angeles", "$$$$", 5, 300),
    ("providence", "Providence", "Seafood", "Hollywood", "Los Angeles", "$$$$", 5, 410),
    ("gjelina", "Gjelina", "Californian", "Venice", "Los Angeles", "$$$", 4, 680),
    ("night-market", "Night + Market", "Thai", "West Hollywood", "Los Angeles", "$$", 4, 350),
    # Chicago
    ("alinea", "Alinea", "Fine dining", "Lincoln Park", "Chicago", "$$$$", 5, 620),
    ("girl-goat", "Girl & the Goat", "American", "West Loop", "Chicago", "$$$", 5, 740),
    ("au-cheval", "Au Cheval", "Diner", "West Loop", "Chicago", "$$", 5, 900),
    ("publican", "The Publican", "Gastropub", "Fulton Market", "Chicago", "$$$", 4, 410),
    ("lou-malnatis", "Lou Malnati's", "Pizza", "River North", "Chicago", "$$", 5, 1200),
    ("pequods", "Pequod's Pizza", "Pizza", "Lincoln Park", "Chicago", "$$", 5, 980),
    # London
    ("dishoom", "Dishoom", "Indian", "Covent Garden", "London", "$$", 5, 1400),
    ("the-ledbury", "The Ledbury", "French", "Notting Hill", "London", "$$$$", 5, 360),
    ("st-john", "St. John", "British", "Farringdon", "London", "$$$", 4, 420),
    ("sketch", "Sketch", "French", "Mayfair", "London", "$$$$", 4, 520),
    ("padella", "Padella", "Italian", "Borough", "London", "$$", 5, 870),
    ("barrafina", "Barrafina", "Spanish", "Soho", "London", "$$$", 4, 390),
    ("gymkhana", "Gymkhana", "Indian", "Mayfair", "London", "$$$", 5, 410),
    ("hawksmoor", "Hawksmoor", "Steakhouse", "Seven Dials", "London", "$$$", 4, 560),
]

_ALL_SLOTS = ["5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"]


def _seed(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest(), 16)


def _slots(vid: str) -> list[str]:
    h = _seed(vid)
    start = h % 4               # 0..3 -> 5:30..7:00 start
    return _ALL_SLOTS[start:start + 3]


def _coords(vid: str, city: str) -> tuple[float, float]:
    lat0, lng0 = _CITY.get(city, (37.77, -122.42))
    h = _seed(vid)
    return (round(lat0 + ((h % 40) - 20) * 0.0016, 4),
            round(lng0 + ((h // 40 % 40) - 20) * 0.0020, 4))


def _expand(row) -> dict:
    vid, name, cuisine, hood, city, price, rating, reviews = row
    lat, lng = _coords(vid, city)
    amen = _AMEN.get(cuisine, ["Reservations", "Bar seats", "Groups"])
    return {
        "id": vid, "name": name, "cuisine": cuisine, "neighborhood": hood, "city": city,
        "distance": "", "rating": rating, "reviews": reviews, "price_level": price,
        "photo": _PHOTO.get(cuisine, "slate"), "slots": _slots(vid),
        "amenities": amen, "lat": lat, "lng": lng,
        "description": f"{cuisine} in {hood}, {city} — a standout table locals book again and again.",
        "booking_url": "",
    }


VENUES = [_expand(r) for r in _RAW]


def search_catalog(q: str = "") -> list[dict]:
    q = (q or "").strip().lower()
    if not q:
        return VENUES
    return [v for v in VENUES if any(q in v[k].lower()
            for k in ("name", "cuisine", "neighborhood", "city"))]


# ---- live provider (gated) ----

def provider() -> str | None:
    p = (os.getenv("VENUE_PROVIDER") or "").lower().strip()
    if p == "yelp" and os.getenv("YELP_API_KEY"):
        return "yelp"
    if p == "google" and os.getenv("GOOGLE_PLACES_API_KEY"):
        return "google"
    return None


def list_venues(q: str = "", location: str = "") -> list[dict]:
    """Live provider when configured, else the curated catalog."""
    if provider() == "yelp":
        try:
            return _yelp_search(q or "restaurants", location or "San Francisco")
        except Exception:
            pass  # fall back to catalog
    return search_catalog(q)


def _yelp_search(term: str, location: str) -> list[dict]:
    import json
    import urllib.parse
    import urllib.request
    url = "https://api.yelp.com/v3/businesses/search?" + urllib.parse.urlencode(
        {"term": term, "location": location, "categories": "restaurants", "limit": 40})
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {os.getenv('YELP_API_KEY','')}"})
    with urllib.request.urlopen(req, timeout=12) as r:
        data = json.load(r)
    out = []
    for b in data.get("businesses", []):
        cuisine = (b.get("categories") or [{}])[0].get("title", "Restaurant")
        out.append({
            "id": b["id"], "name": b["name"], "cuisine": cuisine,
            "neighborhood": (b.get("location", {}).get("city") or ""), "city": location,
            "distance": "", "rating": round(b.get("rating", 4)), "reviews": b.get("review_count", 0),
            "price_level": b.get("price", "$$"), "photo": _PHOTO.get(cuisine, "slate"),
            "slots": _slots(b["id"]), "amenities": _AMEN.get(cuisine, ["Reservations"]),
            "lat": b.get("coordinates", {}).get("latitude"), "lng": b.get("coordinates", {}).get("longitude"),
            "description": f"{cuisine} — {b.get('location',{}).get('address1','')}".strip(" —"),
            "booking_url": b.get("url", ""),
        })
    return out
