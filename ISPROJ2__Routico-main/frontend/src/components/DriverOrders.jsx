import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const DriverOrders = () => {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const mapRefs = useRef({});

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch('http://localhost:3001/api/drivers/me/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setOrders(await res.json());
      } else {
        toast.error('Failed to load orders');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-900/50 text-yellow-400';
      case 'assigned': return 'bg-blue-900/50 text-blue-400';
      case 'in_transit': return 'bg-purple-900/50 text-purple-400';
      case 'delivered': return 'bg-green-900/50 text-green-400';
      case 'completed': return 'bg-emerald-900/50 text-emerald-400';
      case 'cancelled': return 'bg-red-900/50 text-red-400';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  // Initialize map for an order
  const initMapForOrder = useCallback((orderId) => {
    const order = orders.find(o => o.order_id === orderId);
    const mapEl = mapRefs.current[orderId];
    if (!order || !mapEl || !window.google?.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    const geocode = (address) => new Promise(resolve => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK') {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else resolve(null);
      });
    });

    (async () => {
      const pickup = order.pickup_location ? await geocode(order.pickup_location) : null;
      const dropoff = order.drop_off_location ? await geocode(order.drop_off_location) : null;
      if (!pickup || !dropoff) return;

      mapEl.innerHTML = '';
      const map = new window.google.maps.Map(mapEl, { zoom: 12, center: pickup });
      new window.google.maps.Marker({ position: pickup, map, label: 'P', title: 'Pickup', icon: { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' } });
      new window.google.maps.Marker({ position: dropoff, map, label: 'D', title: 'Dropoff', icon: { url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' } });

      const ds = new window.google.maps.DirectionsService();
      const dr = new window.google.maps.DirectionsRenderer({ map, suppressMarkers: true });
      ds.route({ origin: pickup, destination: dropoff, travelMode: window.google.maps.TravelMode.DRIVING, region: 'ph' }, (result, status) => {
        if (status === 'OK') dr.setDirections(result);
      });
    })();
  }, [orders]);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) return;
    if (window.google?.maps) return;
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Init map when order is expanded
  useEffect(() => {
    if (!expandedOrder) return;
    const poll = setInterval(() => {
      if (window.google?.maps && mapRefs.current[expandedOrder]) {
        clearInterval(poll);
        initMapForOrder(expandedOrder);
      }
    }, 200);
    return () => clearInterval(poll);
  }, [expandedOrder, initMapForOrder]);

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.order_status === statusFilter);

  // Separate route-grouped and individual orders
  const routeGroups = {};
  const individualOrders = [];
  filteredOrders.forEach(order => {
    if (order.route_id && order.route_sequence) {
      if (!routeGroups[order.route_id]) routeGroups[order.route_id] = [];
      routeGroups[order.route_id].push(order);
    } else {
      individualOrders.push(order);
    }
  });
  Object.keys(routeGroups).forEach(id => routeGroups[id].sort((a, b) => a.route_sequence - b.route_sequence));

  const statuses = ['all', 'assigned', 'in_transit', 'delivered', 'completed'];

  const getStatusCount = (status) => {
    if (status === 'all') return orders.length;
    return orders.filter(o => o.order_status === status).length;
  };

  const renderOrderCard = (order) => (
    <div key={order.order_id} className="bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors overflow-hidden">
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpandedOrder(expandedOrder === order.order_id ? null : order.order_id)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {order.route_sequence && (
              <span className="w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {order.route_sequence}
              </span>
            )}
            <div>
              <h3 className="text-white font-semibold text-lg">Order #{order.order_id}</h3>
              {order.customer_name && (
                <p className="text-gray-400 text-sm">{order.customer_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
              {order.order_status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedOrder === order.order_id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {order.pickup_location && (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="text-gray-500 text-xs">Pickup</p>
                <p className="text-gray-300">{order.pickup_location}</p>
              </div>
            </div>
          )}
          {order.drop_off_location && (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="text-gray-500 text-xs">Drop-off</p>
                <p className="text-gray-300">{order.drop_off_location}</p>
              </div>
            </div>
          )}
          {order.scheduled_delivery_time && (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-gray-500 text-xs">Scheduled</p>
                <p className="text-gray-300">{new Date(order.scheduled_delivery_time).toLocaleString()}</p>
              </div>
            </div>
          )}
          {order.weight && (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <div>
                <p className="text-gray-500 text-xs">Weight / Size</p>
                <p className="text-gray-300">{order.weight}kg {order.size ? `/ ${order.size}` : ''}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Map */}
      {expandedOrder === order.order_id && (
        <div className="border-t border-gray-700 p-4">
          <p className="text-sm text-blue-400 font-medium mb-2">Route Preview:</p>
          <div
            ref={el => { mapRefs.current[order.order_id] = el; }}
            style={{ width: '100%', height: 300, borderRadius: 8, border: '1px solid #334155', background: '#232946' }}
          />
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-3"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const routeIds = Object.keys(routeGroups);

  return (
    <div>
      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statuses.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-black/20">
              {getStatusCount(status)}
            </span>
          </button>
        ))}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">No Orders Found</h3>
          <p className="text-gray-400">
            {statusFilter === 'all'
              ? 'You have no assigned orders yet.'
              : `No orders with status "${statusFilter.replace('_', ' ')}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Optimized Route Groups */}
          {routeIds.length > 0 && routeIds.map(routeId => {
            const routeOrders = routeGroups[routeId];
            const completedCount = routeOrders.filter(o => o.order_status === 'completed').length;
            const allCompleted = completedCount === routeOrders.length;
            return (
              <div key={routeId} className="border border-purple-500/30 rounded-xl p-4 bg-gray-900/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="text-purple-300 font-semibold">Optimized Route ({routeOrders.length} stops)</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${allCompleted ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-300'}`}>
                    {allCompleted ? 'Route Complete' : `${completedCount}/${routeOrders.length} completed`}
                  </span>
                </div>
                <div className="space-y-3">
                  {routeOrders.map(order => renderOrderCard(order))}
                </div>
              </div>
            );
          })}

          {/* Individual Orders */}
          {individualOrders.length > 0 && routeIds.length > 0 && (
            <h4 className="text-lg font-semibold text-gray-400">Individual Orders</h4>
          )}
          {individualOrders.map(order => renderOrderCard(order))}
        </div>
      )}
    </div>
  );
};

export default DriverOrders;
