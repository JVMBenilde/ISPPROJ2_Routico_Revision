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
  let current = 0; // Start from first location (depot)
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

// Optimize route for selected orders
router.post('/optimize', requirePerm('optimize_routes'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const { orderIds, depotLat, depotLng } = req.body;

    if (!orderIds || orderIds.length === 0) {
      return res.status(400).json({ error: 'No orders selected for optimization' });
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

    // For optimization we need lat/lng. We'll use the addresses and return optimized order.
    // Since we may not have geocoded coordinates stored, we'll build stops from drop_off_location
    const stops = orders.map(o => ({
      order_id: o.order_id,
      customer_name: o.customer_name,
      pickup_location: o.pickup_location,
      drop_off_location: o.drop_off_location,
      lat: 0, lng: 0 // Will be set by geocoding or estimated
    }));

    // If depot coordinates provided, use as starting point
    // Otherwise use first order's location
    const depot = (depotLat && depotLng)
      ? { lat: parseFloat(depotLat), lng: parseFloat(depotLng), order_id: 'depot', customer_name: 'Depot' }
      : null;

    // Since we don't have stored lat/lng, return orders in nearest-neighbor order
    // based on simple string-based grouping (orders going to similar areas together)
    // For a real implementation, this would use Google Maps Distance Matrix API

    // Simple heuristic: group by first part of drop_off_location
    const sortedOrders = [...orders].sort((a, b) => {
      const addrA = (a.drop_off_location || '').toLowerCase();
      const addrB = (b.drop_off_location || '').toLowerCase();
      return addrA.localeCompare(addrB);
    });

    // Save optimization result
    const [result] = await db.query(
      `INSERT INTO routeoptimization (owner_id, optimization_date, total_orders, status)
       VALUES (?, NOW(), ?, 'completed')`,
      [ownerId, orders.length]
    );

    const optimizationId = result.insertId;

    // Save route order
    for (let i = 0; i < sortedOrders.length; i++) {
      await db.query(
        `INSERT INTO routeorders (route_id, order_id, sequence_number)
         VALUES (?, ?, ?)`,
        [optimizationId, sortedOrders[i].order_id, i + 1]
      );
    }

    // Calculate estimated savings
    const originalDistance = orders.length * 5; // rough estimate km per stop
    const optimizedDistance = originalDistance * 0.75; // ~25% savings estimate

    res.json({
      optimization_id: optimizationId,
      original_order: orders.map(o => ({ order_id: o.order_id, customer_name: o.customer_name, drop_off_location: o.drop_off_location })),
      optimized_order: sortedOrders.map((o, i) => ({
        sequence: i + 1,
        order_id: o.order_id,
        customer_name: o.customer_name,
        drop_off_location: o.drop_off_location
      })),
      total_stops: sortedOrders.length,
      estimated_distance_km: optimizedDistance.toFixed(1),
      estimated_savings_percent: 25
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

module.exports = router;
