const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');

// Haversine distance between two lat/lng points (in km)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbor route optimization
function nearestNeighborOptimize(locations) {
  if (locations.length <= 2) return locations;

  const visited = new Set();
  const route = [];
  let current = 0; // Start from first location (depot/pickup)
  visited.add(current);
  route.push(locations[current]);

  while (visited.size < locations.length) {
    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < locations.length; i++) {
      if (visited.has(i)) continue;
      const dist = haversine(
        locations[current].lat, locations[current].lng,
        locations[i].lat, locations[i].lng
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx === -1) break;
    visited.add(nearestIdx);
    route.push(locations[nearestIdx]);
    current = nearestIdx;
  }

  return route;
}

// Calculate total distance for a route
function totalRouteDistance(locations) {
  let total = 0;
  for (let i = 0; i < locations.length - 1; i++) {
    total += haversine(
      locations[i].lat, locations[i].lng,
      locations[i + 1].lat, locations[i + 1].lng
    );
  }
  return total;
}

// Get real road distance, ETA, and traffic info from Google Directions API
async function getDirectionsInfo(locations) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || locations.length < 2) return null;

  try {
    const origin = `${locations[0].lat},${locations[0].lng}`;
    const destination = `${locations[locations.length - 1].lat},${locations[locations.length - 1].lng}`;
    const waypoints = locations.slice(1, -1).map(l => `${l.lat},${l.lng}`).join('|');

    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&departure_time=now&traffic_model=best_guess&alternatives=true&region=ph&key=${apiKey}`;
    if (waypoints) {
      url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      console.warn('Directions API failed:', data.status);
      return null;
    }

    // Parse all routes into the same format
    const allRoutes = data.routes.slice(0, 3).map((route, idx) => {
      const legs = route.legs;
      const totalDistance = legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000;
      const totalDurationTraffic = legs.reduce((sum, leg) => sum + (leg.duration_in_traffic?.value || leg.duration.value), 0);
      return {
        distance_km: Math.round(totalDistance * 10) / 10,
        duration_traffic_minutes: Math.round(totalDurationTraffic / 60),
        summary: route.summary || `Route ${idx + 1}`,
        legs: legs.map(leg => ({
          distance: leg.distance.text,
          duration_traffic: leg.duration_in_traffic?.text || leg.duration.text,
          start: leg.start_address,
          end: leg.end_address
        }))
      };
    });

    // Sort by shortest distance — first route is the recommended one
    allRoutes.sort((a, b) => a.distance_km - b.distance_km);

    return {
      primary: allRoutes[0],
      alternatives: allRoutes.slice(1)
    };
  } catch (error) {
    console.error('Directions API error:', error.message);
    return null;
  }
}

// Geocode an address using Google Maps Geocoding API
async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    console.warn(`Geocoding failed for "${address}": ${data.status}`);
    return null;
  } catch (error) {
    console.error(`Geocoding error for "${address}":`, error.message);
    return null;
  }
}

// Optimize route for selected orders
router.post('/optimize', requirePerm('optimize_routes'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const { orderIds, depotLat, depotLng } = req.body;

    if (!orderIds || orderIds.length < 2) {
      return res.status(400).json({ error: 'Select at least 2 orders for optimization' });
    }

    // Get owner
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }
    const ownerId = ownerResult[0].owner_id;

    // Fetch orders with locations
    const placeholders = orderIds.map(() => '?').join(',');
    const [orders] = await db.query(
      `SELECT o.*, c.company_name as customer_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       WHERE o.order_id IN (${placeholders}) AND o.business_owner_id = ?`,
      [...orderIds, ownerId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'No matching orders found' });
    }

    // Geocode all drop-off addresses using Google Maps
    console.log(`Geocoding ${orders.length} addresses for route optimization...`);
    const geocodedStops = [];

    for (const order of orders) {
      const address = order.drop_off_location;
      const coords = await geocodeAddress(address);

      if (coords) {
        geocodedStops.push({
          order_id: order.order_id,
          customer_name: order.customer_name,
          pickup_location: order.pickup_location,
          drop_off_location: order.drop_off_location,
          lat: coords.lat,
          lng: coords.lng
        });
      } else {
        // If geocoding fails, still include with a note
        geocodedStops.push({
          order_id: order.order_id,
          customer_name: order.customer_name,
          pickup_location: order.pickup_location,
          drop_off_location: order.drop_off_location,
          lat: 0,
          lng: 0,
          geocode_failed: true
        });
      }
    }

    // Separate successfully geocoded and failed stops
    const validStops = geocodedStops.filter(s => !s.geocode_failed);
    const failedStops = geocodedStops.filter(s => s.geocode_failed);

    if (validStops.length < 2) {
      return res.status(400).json({
        error: 'Could not geocode enough addresses. Please ensure at least 2 orders have valid delivery addresses.'
      });
    }

    // If depot coordinates provided, add as starting point
    if (depotLat && depotLng) {
      validStops.unshift({
        order_id: 'depot',
        customer_name: 'Depot (Start)',
        drop_off_location: 'Starting Point',
        lat: parseFloat(depotLat),
        lng: parseFloat(depotLng),
        is_depot: true
      });
    }

    // Calculate original distance (in the order they were submitted)
    const originalDistance = totalRouteDistance(validStops);

    // Run nearest-neighbor optimization
    const optimizedRoute = nearestNeighborOptimize(validStops);

    // Calculate optimized distance
    const optimizedDistance = totalRouteDistance(optimizedRoute);

    // Calculate actual savings
    const savingsPercent = originalDistance > 0
      ? Math.round(((originalDistance - optimizedDistance) / originalDistance) * 100)
      : 0;

    // Filter out depot from the result for DB storage
    const optimizedOrders = optimizedRoute.filter(s => !s.is_depot);

    // Get real road distance, ETA, and traffic data from Google Directions API
    console.log('Fetching Directions API for road distance and ETA...');
    const directionsInfo = await getDirectionsInfo(optimizedRoute);

    // Use Directions API distance if available, otherwise fallback to Haversine
    const roadDistance = directionsInfo ? directionsInfo.primary.distance_km : optimizedDistance;

    // Save optimization result
    const startLocation = optimizedOrders[0]?.pickup_location || '';
    const destination = optimizedOrders[optimizedOrders.length - 1]?.drop_off_location || '';
    const optimizedRouteJson = JSON.stringify(optimizedOrders.map((o, i) => ({
      sequence: i + 1,
      order_id: o.order_id,
      drop_off_location: o.drop_off_location
    })));

    const estimatedTime = directionsInfo ? `${Math.floor(directionsInfo.primary.duration_traffic_minutes / 60)}:${String(directionsInfo.primary.duration_traffic_minutes % 60).padStart(2, '0')}:00` : null;

    const [result] = await db.query(
      `INSERT INTO routeoptimization (start_location, destination, estimated_distance, optimized_route, estimated_time)
       VALUES (?, ?, ?, ?, ?)`,
      [startLocation, destination, roadDistance.toFixed ? roadDistance.toFixed(2) : roadDistance, optimizedRouteJson, estimatedTime]
    );

    const optimizationId = result.insertId;

    // Save route order
    for (let i = 0; i < optimizedOrders.length; i++) {
      await db.query(
        `INSERT INTO routeorders (route_id, order_id)
         VALUES (?, ?)`,
        [optimizationId, optimizedOrders[i].order_id]
      );
    }

    // Append any failed geocode orders at the end
    const fullOptimizedOrder = [
      ...optimizedOrders.map((o, i) => ({
        sequence: i + 1,
        order_id: o.order_id,
        customer_name: o.customer_name,
        pickup_location: o.pickup_location,
        drop_off_location: o.drop_off_location
      })),
      ...failedStops.map((o, i) => ({
        sequence: optimizedOrders.length + i + 1,
        order_id: o.order_id,
        customer_name: o.customer_name,
        pickup_location: o.pickup_location,
        drop_off_location: o.drop_off_location + ' (address could not be located)'
      }))
    ];

    // Calculate savings using road distance
    const roadSavingsPercent = directionsInfo && originalDistance > 0
      ? Math.round(((originalDistance - optimizedDistance) / originalDistance) * 100)
      : savingsPercent;

    res.json({
      optimization_id: optimizationId,
      original_order: orders.map(o => ({
        order_id: o.order_id,
        customer_name: o.customer_name,
        pickup_location: o.pickup_location,
        drop_off_location: o.drop_off_location
      })),
      optimized_order: fullOptimizedOrder,
      total_stops: fullOptimizedOrder.length,
      estimated_distance_km: directionsInfo ? directionsInfo.primary.distance_km : parseFloat(optimizedDistance.toFixed(1)),
      original_distance_km: parseFloat(originalDistance.toFixed(1)),
      estimated_savings_percent: Math.max(0, roadSavingsPercent),
      eta: directionsInfo ? {
        duration_traffic_minutes: directionsInfo.primary.duration_traffic_minutes,
        summary: directionsInfo.primary.summary,
        legs: directionsInfo.primary.legs
      } : null,
      alternative_routes: directionsInfo ? directionsInfo.alternatives : []
    });
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Failed to optimize route' });
  }
});

// Get optimization history
router.get('/history', requirePerm('view_routes'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) return res.json([]);
    const ownerId = ownerResult[0].owner_id;

    const [history] = await db.query(
      `SELECT * FROM routeoptimization WHERE owner_id = ? ORDER BY optimization_date DESC LIMIT 20`,
      [ownerId]
    );

    res.json(history);
  } catch (error) {
    console.error('Error fetching optimization history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Assign a driver to all orders in an optimized route
router.post('/assign-driver', requirePerm('optimize_routes'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const { routeId, driverId, orderIds } = req.body;

    if (!driverId || !orderIds || orderIds.length === 0) {
      return res.status(400).json({ error: 'Driver ID and order IDs are required' });
    }

    // Verify owner
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }
    const ownerId = ownerResult[0].owner_id;

    // Verify driver belongs to this owner
    const [driverResult] = await db.query(
      'SELECT driver_id, first_name, last_name FROM drivers WHERE driver_id = ? AND owner_id = ?',
      [driverId, ownerId]
    );
    if (driverResult.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Assign driver to all orders, set status to 'assigned', and save route info with sequence
    for (let i = 0; i < orderIds.length; i++) {
      await db.query(
        `UPDATE orders SET assigned_driver_id = ?, order_status = 'assigned', route_id = ?, route_sequence = ?
         WHERE order_id = ? AND business_owner_id = ?`,
        [driverId, routeId, i + 1, orderIds[i], ownerId]
      );
    }

    const driverName = `${driverResult[0].first_name} ${driverResult[0].last_name}`;

    // Notify the assigned driver
    if (req.app.locals.notifications) {
      req.app.locals.notifications.createForDriver(
        driverId,
        `You have been assigned ${orderIds.length} orders on route #${routeId}`,
        'order_assignment', parseInt(routeId), 'order'
      ).catch(err => console.error('Notification error:', err));
    }

    res.json({
      success: true,
      driver_id: driverId,
      driver_name: driverName,
      orders_assigned: orderIds.length,
      route_id: routeId
    });
  } catch (error) {
    console.error('Error assigning driver to route:', error);
    res.status(500).json({ error: 'Failed to assign driver to route' });
  }
});

module.exports = router;
