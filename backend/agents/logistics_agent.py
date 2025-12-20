# PROMPT FOR GITHUB COPILOT
# -------------------------
# Context: 
# This is "The Logistics Agent" for the Aegis AI Disaster Response System.
# It is a background Python script that monitors a MongoDB database for "Critical" disaster reports 
# and automatically generates optimized rescue routes using OSRM (Open Source Routing Machine).
#
# Dependencies:
# - pymongo (Database)
# - requests (HTTP calls to OSRM)
# - math (for Haversine formula as fallback)
#
# Data Contract (MongoDB):
# - Input Collection: 'reports'
#   - Document Structure: { '_id': ObjectId, 'location': { 'lat': float, 'lng': float }, 'severity': int, 'dispatch_status': 'Unassigned' }
# - Output Collection: 'missions'
#   - Document Structure: { 'routes': [[lat, lng], ...], 'vehicle_id': int, 'timestamp': datetime }
#
# Logic Flow (Infinite Loop):
# 1. Poll MongoDB every 5 seconds.
# 2. Query: Find all reports where 'severity' > 8 AND 'dispatch_status' == 'Unassigned'.
# 3. For each report/need:
#    - Determine the appropriate station type (police, hospital, fire, rescue)
#    - Find the nearest station of that type
#    - Call OSRM to get road-snapped route geometry
# 4. Atomic Update:
#    - Insert a new document into 'missions' collection with the generated routes.
#    - Update all processed reports: Set 'dispatch_status' = 'Assigned' (to prevent re-routing).
# 5. Logging: Print clear updates like "[Logistics] 🚚 Processing...", "[Logistics] 🗺️ Route generated."

import time
import math
import requests
from datetime import datetime, timezone
from pymongo import MongoClient

# OSRM Configuration
OSRM_BASE_URL = "https://router.project-osrm.org"
OSRM_TIMEOUT = 10  # seconds

# MongoDB Connection Configuration
MONGO_URI = "mongodb://localhost:27017"
DATABASE_NAME = "DisasterResponseDB"
REPORTS_COLLECTION = "reports"
NEEDS_COLLECTION = "needs"
MISSIONS_COLLECTION = "missions"

# Agent Configuration
POLL_INTERVAL_SECONDS = 5
MIN_CLUSTER_SIZE = 1  # Process every single report immediately (hackathon demo)
NUM_VEHICLES = 1  # Single vehicle for individual reports
SEVERITY_THRESHOLD = 0  # Accept all severity levels

# Resource Stations - Multiple depots based on emergency type
RESOURCE_STATIONS = {
    "police": [
        {"name": "Police Station 1 - Pimpri", "lat": 18.6073, "lon": 73.7654},
        {"name": "Police Station 2 - Chinchwad", "lat": 18.6400, "lon": 73.7945},
    ],
    "hospital": [
        {"name": "Hospital 1 - Wakad", "lat": 18.5135, "lon": 73.7604},
        {"name": "Hospital 2 - Hadapsar", "lat": 18.4852, "lon": 73.9047},
        {"name": "Hospital 3 - Hinjewadi", "lat": 18.5870, "lon": 73.7785},
    ],
    "fire": [
        {"name": "Fire Station - Swargate", "lat": 18.4549, "lon": 73.8563},
    ],
    "rescue": [
        {"name": "Rescue Station - Shivajinagar", "lat": 18.5196, "lon": 73.8553},
    ],
}

# Mapping of need types/tags to resource station types (ordered by priority)
# More specific keywords should be checked first
NEED_TO_STATION_MAP = [
    # Fire emergencies (high priority - check first)
    ("fire suppression", "fire"),
    ("fire", "fire"),
    ("burning", "fire"),
    ("smoke", "fire"),
    ("blaze", "fire"),
    # Medical emergencies
    ("medical", "hospital"),
    ("health", "hospital"),
    ("injury", "hospital"),
    ("injured", "hospital"),
    ("sick", "hospital"),
    ("ambulance", "hospital"),
    ("evacuation", "hospital"),  # Evacuation often needs medical
    # Police/Security
    ("police", "police"),
    ("security", "police"),
    ("crime", "police"),
    ("theft", "police"),
    ("violence", "police"),
    ("law", "police"),
    # Rescue operations (lower priority - catch-all for disasters)
    ("rescue", "rescue"),
    ("trapped", "rescue"),
    ("flood", "rescue"),
    ("earthquake", "rescue"),
    ("collapse", "rescue"),
    ("water", "rescue"),
    ("food", "rescue"),
    ("disaster", "rescue"),  # Generic disaster - lowest priority
    ("other", "rescue"),
]

# Default fallback depot (Command Center)
DEFAULT_DEPOT = {"name": "Command Center - Pune", "lat": 18.521, "lon": 73.854}


def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great-circle distance between two points on Earth using the Haversine formula.
    
    Args:
        lat1, lon1: Latitude and longitude of point 1 (in degrees)
        lat2, lon2: Latitude and longitude of point 2 (in degrees)
    
    Returns:
        Distance in meters between the two points
    """
    # Earth's radius in meters
    R = 6371000
    
    # Convert degrees to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def get_osrm_route(waypoints, profile="driving"):
    """
    Get a road-snapped route from OSRM between waypoints.
    
    Args:
        waypoints: List of (lat, lon) tuples
        profile: OSRM profile - 'driving', 'walking', 'cycling'
    
    Returns:
        dict with 'geometry' (list of [lat, lon]), 'distance' (meters), 'duration' (seconds)
        or None if OSRM fails
    """
    if len(waypoints) < 2:
        return None
    
    # OSRM expects coordinates as lon,lat (reversed from our lat,lon format)
    coords_str = ";".join([f"{lon},{lat}" for lat, lon in waypoints])
    url = f"{OSRM_BASE_URL}/route/v1/{profile}/{coords_str}"
    
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false"
    }
    
    try:
        response = requests.get(url, params=params, timeout=OSRM_TIMEOUT)
        data = response.json()
        
        if data.get("code") != "Ok" or not data.get("routes"):
            print(f"[Logistics] ⚠️ OSRM returned no routes: {data.get('code')}")
            return None
        
        osrm_route = data["routes"][0]
        
        # Convert GeoJSON coordinates (lon, lat) to our format (lat, lon)
        geometry = [[coord[1], coord[0]] for coord in osrm_route["geometry"]["coordinates"]]
        
        return {
            "geometry": geometry,
            "distance": osrm_route["distance"],  # meters
            "duration": osrm_route["duration"],  # seconds
        }
        
    except requests.exceptions.Timeout:
        print("[Logistics] ⚠️ OSRM request timed out")
        return None
    except requests.exceptions.RequestException as e:
        print(f"[Logistics] ⚠️ OSRM request failed: {e}")
        return None
    except Exception as e:
        print(f"[Logistics] ⚠️ Error parsing OSRM response: {e}")
        return None


def get_route_with_fallback(origin, destination, station_type, station_name):
    """
    Get route from OSRM with fallback to straight-line if OSRM fails.
    
    Args:
        origin: (lat, lon) tuple for start point
        destination: (lat, lon) tuple for end point
        station_type: Type of station (for metadata)
        station_name: Name of station (for metadata)
    
    Returns:
        Route dictionary with geometry and metadata
    """
    waypoints = [origin, destination]
    
    # Try OSRM first
    osrm_result = get_osrm_route(waypoints)
    
    if osrm_result:
        # OSRM success - use road-snapped route
        return {
            'vehicle_id': 0,
            'route': osrm_result['geometry'],
            'total_distance': osrm_result['distance'],
            'duration': osrm_result['duration'],
            'station_type': station_type,
            'station_name': station_name,
            'is_road_snapped': True,
        }
    else:
        # Fallback to straight-line route
        print(f"[Logistics] ⚠️ Using fallback straight-line route")
        distance = haversine(origin[0], origin[1], destination[0], destination[1])
        return {
            'vehicle_id': 0,
            'route': [list(origin), list(destination)],
            'total_distance': distance,
            'duration': distance / 13.89,  # Assume ~50 km/h average
            'station_type': station_type,
            'station_name': station_name,
            'is_road_snapped': False,
        }


def get_critical_reports(db):
    """
    Query MongoDB for critical unassigned reports.
    
    Args:
        db: MongoDB database instance
    
    Returns:
        List of report documents
    """
    reports_collection = db[REPORTS_COLLECTION]
    
    # Query for fully analyzed reports with high severity that haven't been clustered yet
    query = {
        'oracleData.severity': {'$gt': SEVERITY_THRESHOLD},
        'status': {'$in': ['Analyzed_Full', 'Analyzed']},
        '$or': [
            {'dispatch_status': {'$exists': False}},
            {'dispatch_status': 'Unassigned'},
            {'dispatch_status': 'Pending'}  # Include rerouted reports
        ]
    }
    
    reports = list(reports_collection.find(query))
    return reports


def get_verified_needs(db):
    """
    Query MongoDB for verified needs that haven't been dispatched yet.
    
    Args:
        db: MongoDB database instance
    
    Returns:
        List of verified need documents
    """
    needs_collection = db[NEEDS_COLLECTION]
    
    # Query for verified needs that haven't been dispatched yet
    query = {
        'status': 'Verified',
        '$or': [
            {'dispatch_status': {'$exists': False}},
            {'dispatch_status': 'Unassigned'},
            {'dispatch_status': 'Pending'}  # Include rerouted needs
        ],
        'coordinates.lat': {'$exists': True},
        'coordinates.lon': {'$exists': True}
    }
    
    needs = list(needs_collection.find(query))
    return needs


def determine_station_type_for_need(need):
    """
    Determine which type of station should respond based on need type.
    If the need was rerouted, use the rerouted_to_station instead.
    
    Args:
        need: Need document from MongoDB
    
    Returns:
        Station type string (police, hospital, fire, rescue)
    """
    # Check if this need was manually rerouted to a specific station
    rerouted_station = need.get('rerouted_to_station')
    if rerouted_station and rerouted_station.get('type'):
        station_type = rerouted_station.get('type')
        print(f"[Logistics]    🔄 Rerouted to {station_type.upper()} ({rerouted_station.get('name', 'Unknown')})")
        return station_type
    
    need_type = need.get('triageData', {}).get('needType', '').lower()
    raw_message = need.get('rawMessage', '').lower()
    details = need.get('triageData', {}).get('details', '').lower()
    
    # Combine all text for keyword matching
    combined_text = f"{need_type} {raw_message} {details}"
    
    # Check keywords
    for keyword, station_type in NEED_TO_STATION_MAP:
        if keyword in combined_text:
            print(f"[Logistics]    Matched keyword '{keyword}' -> {station_type.upper()}")
            return station_type
    
    # Map need types directly
    need_type_map = {
        'medical': 'hospital',
        'rescue': 'rescue',
        'water': 'rescue',
        'food': 'rescue',
        'other': 'rescue',
    }
    
    if need_type in need_type_map:
        print(f"[Logistics]    Matched needType '{need_type}' -> {need_type_map[need_type].upper()}")
        return need_type_map[need_type]
    
    print(f"[Logistics]    No match found, defaulting to RESCUE")
    return "rescue"


def save_need_mission(db, routes, need_ids, station_info=None):
    """
    Save the generated mission for verified needs to MongoDB and update processed needs.
    
    Args:
        db: MongoDB database instance
        routes: List of route dictionaries
        need_ids: List of ObjectIds of processed needs
        station_info: Information about the dispatching station
    """
    missions_collection = db[MISSIONS_COLLECTION]
    needs_collection = db[NEEDS_COLLECTION]
    
    # Create mission document
    mission = {
        'routes': routes,
        'timestamp': datetime.now(timezone.utc),
        'need_ids': need_ids,
        'source': 'verified_need',
        'status': 'Active',
        'num_vehicles': NUM_VEHICLES,
        'station': station_info,
    }
    
    # Insert mission
    result = missions_collection.insert_one(mission)
    mission_id = result.inserted_id
    
    # Update all processed needs to 'InProgress' and mark as dispatched
    needs_collection.update_many(
        {'_id': {'$in': need_ids}},
        {
            '$set': {
                'dispatch_status': 'Assigned',
                'status': 'InProgress',
                'mission_id': mission_id,
                'assigned_at': datetime.now(timezone.utc),
                'assigned_station': station_info,
            }
        }
    )
    
    return mission_id


def get_nearest_station(report_lat, report_lng, station_type):
    """
    Find the nearest station of a given type to the report location.
    
    Args:
        report_lat: Report latitude
        report_lng: Report longitude
        station_type: Type of station (police, hospital, fire, rescue)
    
    Returns:
        Nearest station dict with name, lat, lon
    """
    stations = RESOURCE_STATIONS.get(station_type, [])
    
    if not stations:
        return DEFAULT_DEPOT
    
    nearest = None
    min_distance = float('inf')
    
    for station in stations:
        dist = haversine(report_lat, report_lng, station['lat'], station['lon'])
        if dist < min_distance:
            min_distance = dist
            nearest = station
    
    return nearest if nearest else DEFAULT_DEPOT


def determine_station_type(report):
    """
    Determine which type of station should respond based on report needs/tags.
    Priority: rerouted_to_station > needs array > text content > tag
    
    Args:
        report: Report document from MongoDB
    
    Returns:
        Station type string (police, hospital, fire, rescue)
    """
    # Priority 0: Check if manually rerouted to a specific station
    rerouted = report.get('rerouted_to_station')
    if rerouted and rerouted.get('type'):
        print(f"[Logistics]    Report was manually rerouted to {rerouted.get('type').upper()} - {rerouted.get('name', 'Unknown')}")
        return rerouted.get('type')
    
    # Check oracle data needs
    needs = report.get('oracleData', {}).get('needs', [])
    tag = report.get('sentinelData', {}).get('tag', '').lower()
    text = report.get('text', '').lower()
    
    # Priority 1: Check needs array first (most specific)
    for need in needs:
        need_lower = need.lower()
        for keyword, station_type in NEED_TO_STATION_MAP:
            if keyword in need_lower:
                print(f"[Logistics]    Matched need '{need}' -> {station_type.upper()}")
                return station_type
    
    # Priority 2: Check text content
    for keyword, station_type in NEED_TO_STATION_MAP:
        if keyword in text:
            print(f"[Logistics]    Matched text keyword '{keyword}' -> {station_type.upper()}")
            return station_type
    
    # Priority 3: Check tag (least specific, often generic like "Disaster")
    for keyword, station_type in NEED_TO_STATION_MAP:
        if keyword in tag:
            print(f"[Logistics]    Matched tag '{tag}' with '{keyword}' -> {station_type.upper()}")
            return station_type
    
    # Default to rescue
    print(f"[Logistics]    No match found, defaulting to RESCUE")
    return "rescue"


def save_mission(db, routes, report_ids, station_info=None):
    """
    Save the generated mission to MongoDB and update processed reports.
    
    Args:
        db: MongoDB database instance
        routes: List of route dictionaries
        report_ids: List of ObjectIds of processed reports
        station_info: Information about the dispatching station
    """
    missions_collection = db[MISSIONS_COLLECTION]
    reports_collection = db[REPORTS_COLLECTION]
    
    # Create mission document
    mission = {
        'routes': routes,
        'timestamp': datetime.now(timezone.utc),
        'report_ids': report_ids,
        'status': 'Active',
        'num_vehicles': NUM_VEHICLES,
        'station': station_info,
    }
    
    # Insert mission
    result = missions_collection.insert_one(mission)
    mission_id = result.inserted_id
    
    # Update all processed reports to 'Assigned'
    reports_collection.update_many(
        {'_id': {'$in': report_ids}},
        {
            '$set': {
                'dispatch_status': 'Assigned',
                'mission_id': mission_id,
                'assigned_at': datetime.now(timezone.utc),
                'assigned_station': station_info,
            }
        }
    )
    
    return mission_id


def run_logistics_agent():
    """
    Main agent loop that continuously monitors for:
    1. Critical reports (from visual/audio reporting)
    2. Verified needs (volunteer-verified SMS requests)
    
    Generates optimized rescue routes from appropriate resource stations for both.
    """
    print("[Logistics] 🚀 Starting Multi-Station Logistics Agent...")
    print("[Logistics] 📊 Monitoring: Reports + Verified Needs")
    print(f"[Logistics] 📡 Connecting to MongoDB at {MONGO_URI}")
    
    try:
        client = MongoClient(MONGO_URI)
        db = client[DATABASE_NAME]
        
        # Test connection
        client.admin.command('ping')
        print(f"[Logistics] ✅ Connected to database: {DATABASE_NAME}")
        
    except Exception as e:
        print(f"[Logistics] ❌ Failed to connect to MongoDB: {e}")
        return
    
    # Print available stations
    print(f"[Logistics] 🏥 Resource Stations:")
    for station_type, stations in RESOURCE_STATIONS.items():
        for s in stations:
            print(f"[Logistics]    {station_type.upper()}: {s['name']} ({s['lat']}, {s['lon']})")
    
    print(f"[Logistics] 🔄 Polling every {POLL_INTERVAL_SECONDS} seconds...")
    print("-" * 60)
    
    while True:
        try:
            # ========================================
            # PART 1: Process analyzed reports
            # ========================================
            reports = get_critical_reports(db)
            num_reports = len(reports)
            
            if num_reports >= MIN_CLUSTER_SIZE:
                print(f"[Logistics] 🚚 Processing {num_reports} reports...")
                
                for report in reports:
                    try:
                        # Get report location
                        if 'location' not in report or 'lat' not in report['location']:
                            print(f"[Logistics] ⚠️ Report {report.get('reportId', report['_id'])} has no location. Skipping...")
                            continue
                        
                        report_lat = report['location']['lat']
                        report_lng = report['location']['lng']
                        report_id = report['_id']
                        report_uuid = report.get('reportId', str(report_id))
                        
                        # Determine which type of station should respond
                        station_type = determine_station_type(report)
                        
                        # Check if manually rerouted to a specific station
                        rerouted = report.get('rerouted_to_station')
                        if rerouted and rerouted.get('lat') and rerouted.get('lon'):
                            # Use the specific station the user selected
                            station = {
                                'name': rerouted.get('name'),
                                'lat': rerouted.get('lat'),
                                'lon': rerouted.get('lon'),
                                'type': rerouted.get('type')
                            }
                        else:
                            # Find nearest station of that type
                            station = get_nearest_station(report_lat, report_lng, station_type)
                        
                        print(f"[Logistics] 📍 Report: {report_uuid}")
                        print(f"[Logistics]    Need type: {station_type.upper()}")
                        print(f"[Logistics]    Dispatching from: {station['name']}")
                        
                        # Create route: Station -> Report Location using OSRM
                        depot_location = (station['lat'], station['lon'])
                        report_location = (report_lat, report_lng)
                        
                        # Get road-snapped route from OSRM
                        route = get_route_with_fallback(
                            depot_location, 
                            report_location, 
                            station_type, 
                            station['name']
                        )
                        routes = [route]
                        
                        # Save mission
                        station_info = {
                            'type': station_type,
                            'name': station['name'],
                            'lat': station['lat'],
                            'lon': station['lon'],
                        }
                        mission_id = save_mission(db, routes, [report_id], station_info)
                        
                        # Log success
                        distance_km = routes[0]['total_distance'] / 1000 if routes else 0
                        route_type = "🛣️ road-snapped" if route.get('is_road_snapped') else "📏 straight-line"
                        print(f"[Logistics] ✅ Mission {mission_id} created (Report)")
                        print(f"[Logistics]    🚗 {station_type.upper()} unit dispatched, {distance_km:.2f} km ({route_type})")
                        
                    except Exception as e:
                        print(f"[Logistics] ❌ Error processing report: {e}")
                        continue
            
            # ========================================
            # PART 2: Process verified needs (volunteer verified tasks)
            # ========================================
            verified_needs = get_verified_needs(db)
            num_needs = len(verified_needs)
            
            if num_needs >= MIN_CLUSTER_SIZE:
                print(f"[Logistics] 📋 Processing {num_needs} verified needs...")
                
                for need in verified_needs:
                    try:
                        # Get need location
                        coords = need.get('coordinates', {})
                        if not coords.get('lat') or not coords.get('lon'):
                            print(f"[Logistics] ⚠️ Need {need['_id']} has no coordinates. Skipping...")
                            continue
                        
                        need_lat = coords['lat']
                        need_lon = coords['lon']
                        need_id = need['_id']
                        
                        # Determine which type of station should respond
                        station_type = determine_station_type_for_need(need)
                        
                        # Check if manually rerouted to a specific station
                        rerouted = need.get('rerouted_to_station')
                        if rerouted and rerouted.get('lat') and rerouted.get('lon'):
                            # Use the specific station the user selected
                            station = {
                                'name': rerouted.get('name'),
                                'lat': rerouted.get('lat'),
                                'lon': rerouted.get('lon'),
                                'type': rerouted.get('type')
                            }
                        else:
                            # Find nearest station of that type
                            station = get_nearest_station(need_lat, need_lon, station_type)
                        
                        need_type = need.get('triageData', {}).get('needType', 'Unknown')
                        print(f"[Logistics] 📋 Verified Need: {need_id}")
                        print(f"[Logistics]    Type: {need_type}")
                        print(f"[Logistics]    Station type: {station_type.upper()}")
                        print(f"[Logistics]    Dispatching from: {station['name']}")
                        
                        # Create route: Station -> Need Location using OSRM
                        depot_location = (station['lat'], station['lon'])
                        need_location = (need_lat, need_lon)
                        
                        # Get road-snapped route from OSRM
                        route = get_route_with_fallback(
                            depot_location, 
                            need_location, 
                            station_type, 
                            station['name']
                        )
                        routes = [route]
                        
                        # Save mission for verified need
                        station_info = {
                            'type': station_type,
                            'name': station['name'],
                            'lat': station['lat'],
                            'lon': station['lon'],
                        }
                        mission_id = save_need_mission(db, routes, [need_id], station_info)
                        
                        # Log success
                        distance_km = routes[0]['total_distance'] / 1000 if routes else 0
                        route_type = "🛣️ road-snapped" if route.get('is_road_snapped') else "📏 straight-line"
                        print(f"[Logistics] ✅ Mission {mission_id} created (Verified Need)")
                        print(f"[Logistics]    🚗 {station_type.upper()} unit dispatched, {distance_km:.2f} km ({route_type})")
                        
                    except Exception as e:
                        print(f"[Logistics] ❌ Error processing verified need: {e}")
                        continue
            
            # Log status if nothing to process
            if num_reports < MIN_CLUSTER_SIZE and num_needs < MIN_CLUSTER_SIZE:
                print(f"[Logistics] 🔍 Found {num_reports} reports, {num_needs} verified needs. Waiting...")
            
            print("-" * 60)
            
        except Exception as e:
            print(f"[Logistics] ❌ Error in agent loop: {e}")
        
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_logistics_agent()
