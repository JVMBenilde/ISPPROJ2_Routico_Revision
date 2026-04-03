import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const LiveTrackingMap = () => {
  const { getToken } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const fetchDriverLocations = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/tracking/drivers/locations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error('Error fetching driver locations:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Poll every 30 seconds
  useEffect(() => {
    fetchDriverLocations();
    const interval = setInterval(fetchDriverLocations, 30000);
    return () => clearInterval(interval);
  }, [fetchDriverLocations]);

  // Load Google Maps
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey || window.google?.maps) return;
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Initialize/update map with driver markers
  useEffect(() => {
    if (!window.google?.maps || !mapRef.current) return;

    // Initialize map once
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 11,
        center: { lat: 14.5995, lng: 120.9842 }, // Metro Manila default
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255d6a' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] }
        ]
      });

      // Add traffic layer
      const trafficLayer = new window.google.maps.TrafficLayer();
      trafficLayer.setMap(mapInstanceRef.current);
    }

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (drivers.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    drivers.forEach(driver => {
      if (!driver.latitude || !driver.longitude) return;

      const pos = { lat: driver.latitude, lng: driver.longitude };
      bounds.extend(pos);

      const color = driver.order_status === 'in_transit' ? '#22c55e' :
                    driver.order_status === 'assigned' ? '#3b82f6' : '#6b7280';

      const marker = new window.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: driver.driver_name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2
        },
        label: {
          text: driver.driver_name?.charAt(0) || 'D',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 'bold'
        }
      });

      const infoContent = `
        <div style="color:#000;padding:4px;min-width:150px">
          <strong>${driver.driver_name}</strong><br/>
          <span style="color:#666">Status: ${driver.order_status || 'idle'}</span><br/>
          ${driver.current_order_id ? `<span style="color:#666">Order #${driver.current_order_id}</span><br/>` : ''}
          <span style="color:#999;font-size:11px">Updated: ${driver.last_updated ? formatDistanceToNow(new Date(driver.last_updated), { addSuffix: true }) : 'N/A'}</span>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({ content: infoContent });
      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    if (drivers.length > 0) {
      mapInstanceRef.current.fitBounds(bounds);
      if (drivers.length === 1) mapInstanceRef.current.setZoom(14);
    }
  }, [drivers]);

  // Poll for map script availability
  useEffect(() => {
    if (window.google?.maps) return;
    const poll = setInterval(() => {
      if (window.google?.maps && mapRef.current) {
        clearInterval(poll);
        // Trigger re-render to init map
        setDrivers(prev => [...prev]);
      }
    }, 500);
    return () => clearInterval(poll);
  }, []);

  const activeDrivers = drivers.filter(d => d.order_status === 'in_transit');
  const assignedDrivers = drivers.filter(d => d.order_status === 'assigned');

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-sm text-gray-300">In Transit: {activeDrivers.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          <span className="text-sm text-gray-300">Assigned: {assignedDrivers.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-500"></span>
          <span className="text-sm text-gray-300">Total Tracked: {drivers.length}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchDriverLocations(); }}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full rounded-xl border border-gray-700 overflow-hidden"
        style={{ height: 500, background: '#1d2c4d' }}
      />

      {/* Driver List */}
      {drivers.length === 0 && !loading && (
        <div className="text-center py-8 bg-gray-800 rounded-xl border border-gray-700">
          <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-400 text-sm">No driver locations available yet.</p>
          <p className="text-gray-500 text-xs mt-1">Drivers will appear here once they enable location sharing.</p>
        </div>
      )}

      {drivers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {drivers.map(d => (
            <div key={d.driver_id} className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                d.order_status === 'in_transit' ? 'bg-green-500' :
                d.order_status === 'assigned' ? 'bg-blue-500' : 'bg-gray-500'
              }`}></div>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{d.driver_name}</p>
                <p className="text-xs text-gray-500">
                  {d.current_order_id ? `Order #${d.current_order_id}` : 'No active order'}
                  {d.last_updated && ` · ${formatDistanceToNow(new Date(d.last_updated), { addSuffix: true })}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveTrackingMap;
