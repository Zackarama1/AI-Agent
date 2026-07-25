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
# Signature-dish highlights per cuisine. A real, per-dish menu needs a menu
# feed (not exposed by Yelp/Google) — these give an accurate flavour of the
# kitchen until a menu provider is wired in. Each: (dish, short note, price).
_MENU = {
    "Italian": [("Cacio e pepe", "hand-cut tonnarelli, pecorino", "$26"),
                ("Margherita", "San Marzano, buffalo mozzarella", "$21"),
                ("Tiramisù", "mascarpone, espresso, cocoa", "$14")],
    "Steakhouse": [("Dry-aged ribeye", "45-day, 16oz", "$68"),
                   ("Creamed spinach", "the classic side", "$14"),
                   ("Wedge salad", "blue cheese, bacon", "$16")],
    "Seafood": [("Oysters", "half-dozen, mignonette", "$24"),
                ("Whole branzino", "grilled, salsa verde", "$42"),
                ("Lobster roll", "warm butter, brioche", "$32")],
    "French": [("Steak frites", "hanger, café de Paris butter", "$38"),
               ("French onion soup", "gruyère crust", "$16"),
               ("Crème brûlée", "Tahitian vanilla", "$13")],
    "Fine dining": [("Tasting menu", "seasonal, ~9 courses", "$225"),
                    ("Wine pairing", "sommelier's flight", "$150"),
                    ("Caviar service", "supplement", "$95")],
    "Tasting": [("Chef's counter menu", "market-driven", "$185"),
                ("Snacks", "one-bite openers", "—"),
                ("Petit fours", "to finish", "—")],
    "Indian": [("Black daal", "24-hour, house classic", "$12"),
               ("Chicken ruby", "makhani, tomato & cream", "$16"),
               ("Naan basket", "garlic, cheese, plain", "$9")],
    "Pizza": [("Deep dish", "sausage, house red", "$24"),
              ("Margherita", "fresh basil, mozzarella", "$19"),
              ("Caesar", "chopped, garlic croutons", "$12")],
    "Deli": [("Pastrami on rye", "hand-carved, mustard", "$27"),
             ("Matzo ball soup", "the cure-all", "$9"),
             ("Black-and-white", "classic cookie", "$5")],
    "Mexican": [("Duck carnitas", "heirloom tortillas", "$28"),
                ("Guacamole", "made to order", "$14"),
                ("Mezcal flight", "three pours", "$26")],
    "Californian": [("Wood-grilled vegetables", "from the market", "$18"),
                    ("Roast chicken for two", "bread salad", "$56"),
                    ("Natural wine", "by the glass", "$16")],
    "Greek": [("Grilled octopus", "lemon, oregano", "$24"),
              ("Lamb chops", "charcoal-grilled", "$46"),
              ("Baklava", "walnut, honey", "$12")],
    "Thai": [("Khao soi", "northern curry noodles", "$18"),
             ("Papaya salad", "pounded to order", "$14"),
             ("Sticky rice & mango", "in season", "$11")],
    "British": [("Roast bone marrow", "parsley salad", "$18"),
                ("Sunday roast", "beef, all the trimmings", "$32"),
                ("Sticky toffee", "date pudding", "$12")],
    "Spanish": [("Jamón ibérico", "hand-carved", "$28"),
                ("Tortilla", "slow-cooked", "$12"),
                ("Gambas al ajillo", "garlic prawns", "$18")],
    "Gastropub": [("Burger", "aged cheddar, house pickles", "$21"),
                  ("Fish & chips", "beer batter", "$24"),
                  ("Seasonal pie", "ask your server", "$19")],
    "New American": [("Wood-grilled fish", "market vegetables", "$34"),
                     ("Duck breast", "seasonal fruit, jus", "$38"),
                     ("Warm chocolate cake", "crème fraîche", "$13")],
    "American": [("Roast chicken", "for two, pan gravy", "$52"),
                 ("Little gem salad", "buttermilk, herbs", "$15"),
                 ("Skillet cornbread", "honey butter", "$9")],
    "Small plates": [("Chef's choice", "a run of small plates", "$14"),
                     ("Pancakes", "the signature savory bite", "$16"),
                     ("Seasonal dessert", "ask your server", "$12")],
    "Diner": [("Cheeseburger", "single or double", "$13"),
              ("Bologna sandwich", "the cult favorite", "$11"),
              ("Milkshake", "thick, classic", "$7")],
    "Bakery": [("Morning bun", "flaky, sugared", "$6"),
               ("Country loaf", "naturally leavened", "$9"),
               ("Seasonal tart", "fruit & cream", "$8")],
    "Oaxacan": [("Mole negro", "the house classic", "$22"),
                ("Tlayuda", "Oaxacan-style", "$18"),
                ("Mezcal flight", "small-batch", "$24")],
    "Kaiseki": [("Omakase menu", "multi-course, seasonal", "$225"),
                ("Sashimi course", "daily selection", "—"),
                ("Wagyu course", "premium supplement", "$45")],
    "Mediterranean": [("Wood-oven flatbread", "za'atar, olive oil", "$14"),
                      ("Whole roasted fish", "lemon, herbs", "$40"),
                      ("Olive-oil cake", "citrus, cream", "$12")],
    "Food hall": [("Ramen", "rich house broth", "$16"),
                  ("Bao buns", "steamed, filled", "$12"),
                  ("Soft serve", "seasonal swirl", "$6")],
}
def _menu_for(cuisine: str) -> list[dict]:
    items = _MENU.get(cuisine) or _MENU.get("Californian")
    return [{"name": n, "note": d, "price": p} for (n, d, p) in items]
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
        "photo": _PHOTO.get(cuisine, "slate"), "photos": [], "slots": _slots(vid),
        "amenities": amen, "menu": _menu_for(cuisine), "lat": lat, "lng": lng,
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
    p = provider()
    if p == "yelp":
        try:
            return _yelp_search(q or "restaurants", location or "San Francisco")
        except Exception:
            pass  # fall back to catalog
    if p == "google":
        try:
            return _google_search(q or "restaurants", location or "San Francisco")
        except Exception:
            pass
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
        img = b.get("image_url") or ""
        out.append({
            "id": b["id"], "name": b["name"], "cuisine": cuisine,
            "neighborhood": (b.get("location", {}).get("city") or ""), "city": location,
            "distance": "", "rating": round(b.get("rating", 4)), "reviews": b.get("review_count", 0),
            "price_level": b.get("price", "$$"), "photo": _PHOTO.get(cuisine, "slate"),
            "photos": [img] if img else [],
            "slots": _slots(b["id"]), "amenities": _AMEN.get(cuisine, ["Reservations"]),
            "menu": _menu_for(cuisine),
            "lat": b.get("coordinates", {}).get("latitude"), "lng": b.get("coordinates", {}).get("longitude"),
            "description": f"{cuisine} — {b.get('location',{}).get('address1','')}".strip(" —"),
            "booking_url": b.get("url", ""),
        })
    return out


def _google_search(term: str, location: str) -> list[dict]:
    """Google Places Text Search + photo URLs. Real listings with real photos."""
    import json
    import urllib.parse
    import urllib.request
    key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json?" + urllib.parse.urlencode(
        {"query": f"restaurants in {location}" if not term or term == "restaurants" else f"{term} in {location}",
         "type": "restaurant", "key": key})
    with urllib.request.urlopen(url, timeout=12) as r:
        data = json.load(r)
    _PL = {0: "", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$"}
    out = []
    for b in data.get("results", [])[:40]:
        cuisine = (b.get("types") or ["Restaurant"])[0].replace("_", " ").title()
        if cuisine in ("Restaurant", "Food", "Point Of Interest", "Establishment"):
            cuisine = "Restaurant"
        ref = ((b.get("photos") or [{}])[0]).get("photo_reference", "")
        photo = ("https://maps.googleapis.com/maps/api/place/photo?" + urllib.parse.urlencode(
            {"maxwidth": 800, "photo_reference": ref, "key": key})) if ref else ""
        loc = b.get("geometry", {}).get("location", {})
        out.append({
            "id": b.get("place_id", b.get("name", "")), "name": b.get("name", ""), "cuisine": cuisine,
            "neighborhood": (b.get("vicinity") or b.get("formatted_address") or "").split(",")[0], "city": location,
            "distance": "", "rating": round(b.get("rating", 4)), "reviews": b.get("user_ratings_total", 0),
            "price_level": _PL.get(b.get("price_level", 2), "$$"), "photo": _PHOTO.get(cuisine, "slate"),
            "photos": [photo] if photo else [],
            "slots": _slots(b.get("place_id", "x")), "amenities": _AMEN.get(cuisine, ["Reservations"]),
            "menu": _menu_for(cuisine),
            "lat": loc.get("lat"), "lng": loc.get("lng"),
            "description": f"{cuisine} — {b.get('formatted_address','')}".strip(" —"),
            "booking_url": "",
        })
    return out
