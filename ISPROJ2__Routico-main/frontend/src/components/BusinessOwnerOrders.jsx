import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';
import { format, isToday, isAfter, parseISO } from 'date-fns';
import CascadingAddressSelector from './CascadingAddressSelector';

const BusinessOwnerOrders = ({ routeOptimizationOnly = false }) => {
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mapsError, setMapsError] = useState(null);
  
  // Google Maps refs
  const pickupInputRef = useRef(null);
  const deliveryInputRef = useRef(null);
  const pickupAutocompleteRef = useRef(null);
  const deliveryAutocompleteRef = useRef(null);
  const mapRef = useRef(null);
  
  // Form state - matching database schema
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    pickupAddress: '',
    dropoffAddress: '', // database uses dropoff_address
    pickupLocation: null, // { lat, lng } - for map display
    dropoffLocation: null, // { lat, lng } - for map display
    itemWeight: '',
    size: '', // item dimensions
    scheduledDate: '',
    scheduledTime: '',
    routeDistance: 0, // Real road distance in km
    routeDuration: 0,
    deliveryFee: '',
  });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const orderDetailMapRef = useRef(null); // For detail view map
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [deleting, setDeleting] = useState(false); // for confirmation
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [assigningDriver, setAssigningDriver] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusLog, setStatusLog] = useState([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [showOptimize, setShowOptimize] = useState(routeOptimizationOnly);
  const [selectedForOptimize, setSelectedForOptimize] = useState([]);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeDetails, setRouteDetails] = useState(null); // { summary, alternatives }
  const [selectedSingleRouteIndex, setSelectedSingleRouteIndex] = useState(0);
  const [lastTrafficUpdate, setLastTrafficUpdate] = useState(null);
  const [orderRouteDetails, setOrderRouteDetails] = useState(null);
  const [selectedOrderRouteIndex, setSelectedOrderRouteIndex] = useState(0);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const orderDetailRef = useRef(null);
  const optimizationMapRef = useRef(null);
  // Helper to update orders in-place
  const updateOrderInState = updated => setOrders(orders => orders.map(o => o.order_id === updated.order_id ? updated : o));
  const removeOrderFromState = id => setOrders(orders => orders.filter(o => o.order_id !== id));

  // Fetch available drivers for assignment
  const fetchDrivers = async () => {
    if (!user) return;
    try {
      const token = getToken();
      const res = await fetch('http://localhost:3001/api/drivers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableDrivers(data.filter(d => d.status === 'active'));
      }
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
    }
  };

  // Assign driver to order
  const handleAssignDriver = async (orderId, driverId) => {
    setAssigningDriver(true);
    try {
      const token = getToken();
      const res = await fetch(`http://localhost:3001/api/orders/${orderId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ driverId: driverId || null })
      });
      if (res.ok) {
        const updated = await res.json();
        updateOrderInState(updated);
        setSelectedOrder(updated);
        toast.success(driverId ? 'Driver assigned successfully' : 'Driver unassigned');
      } else {
        toast.error('Failed to assign driver');
      }
    } catch (err) {
      toast.error('Failed to assign driver');
    } finally {
      setAssigningDriver(false);
    }
  };

  // Update order status
  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus(true);
    try {
      const token = getToken();
      const res = await fetch(`http://localhost:3001/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        updateOrderInState(updated);
        setSelectedOrder(updated);
        toast.success(`Status updated to ${newStatus}`);
        // Notify dashboard to refresh stats
        window.dispatchEvent(new Event('ordersUpdated'));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update status');
      }
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Fetch tracking status log for an order
  const fetchStatusLog = async (orderId) => {
    setLoadingLog(true);
    try {
      const token = getToken();
      const res = await fetch(`http://localhost:3001/api/tracking/${orderId}/status-log`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatusLog(data);
      } else {
        setStatusLog([]);
      }
    } catch (err) {
      setStatusLog([]);
    } finally {
      setLoadingLog(false);
    }
  };

  // Route optimization
  const handleOptimizeRoutes = async () => {
    if (selectedForOptimize.length < 2) {
      toast.error('Select at least 2 orders to optimize');
      return;
    }
    setOptimizing(true);
    try {
      const token = getToken();
      const res = await fetch('http://localhost:3001/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderIds: selectedForOptimize })
      });
      if (res.ok) {
        const data = await res.json();
        setOptimizationResult(data);
        toast.success('Routes optimized successfully!');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to optimize routes');
      }
    } catch (err) {
      toast.error('Failed to optimize routes');
    } finally {
      setOptimizing(false);
    }
  };

  // Traffic on the optimization map updates automatically via Google's TrafficLayer
  // No need to re-call the backend — the map overlay is truly live

  const editPickupInputRef = useRef(null);
  const editDropoffInputRef = useRef(null);
  const editPickupAutocompleteRef = useRef(null);
  const editDropoffAutocompleteRef = useRef(null);

  useEffect(() => {
    if (!editMode) return;
    // Google Places Autocomplete for pickup and dropoff in edit
    if (window.google && window.google.maps && window.google.maps.places) {
      if (editPickupInputRef.current && !editPickupAutocompleteRef.current) {
        editPickupAutocompleteRef.current = new window.google.maps.places.Autocomplete(
          editPickupInputRef.current,
          { types: ['address'], componentRestrictions: { country: 'ph' } }
        );
        editPickupAutocompleteRef.current.addListener('place_changed', () => {
          const place = editPickupAutocompleteRef.current.getPlace();
          if (place.formatted_address) {
            setEditFields(f => ({ ...f, pickup_location: place.formatted_address }));
          }
        });
      }
      if (editDropoffInputRef.current && !editDropoffAutocompleteRef.current) {
        editDropoffAutocompleteRef.current = new window.google.maps.places.Autocomplete(
          editDropoffInputRef.current,
          { types: ['address'], componentRestrictions: { country: 'ph' } }
        );
        editDropoffAutocompleteRef.current.addListener('place_changed', () => {
          const place = editDropoffAutocompleteRef.current.getPlace();
          if (place.formatted_address) {
            setEditFields(f => ({ ...f, drop_off_location: place.formatted_address }));
          }
        });
      }
    }
    // Cleanup on edit exit
    return () => {
      editPickupAutocompleteRef.current = null;
      editDropoffAutocompleteRef.current = null;
    };
  }, [editMode]);

  useEffect(() => {
    // Initialize Google Maps when component mounts
    // Use dedicated Google Maps API key, fallback to Firebase API key
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY;
    
    console.log('VITE_FIREBASE_API_KEY exists:', !!apiKey);
    if (apiKey) {
      console.log('API Key first 10 chars:', apiKey.substring(0, 10) + '...');
    }
    
    if (!apiKey) {
      console.error('Google Maps API key is not configured!');
      setMapsError('Google Maps API key is not configured. Please check your .env file.');
      return;
    }
    
    if (window.google && window.google.maps) {
      console.log('Google Maps already available');
      initializeGoogleMaps();
    } else {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        console.log('Google Maps script already in DOM, polling for availability...');
        const poll = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(poll);
            initializeGoogleMaps();
          }
        }, 200);
        return;
      }
      
      console.log('Loading Google Maps script...');
      const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,directions`;
      console.log('Script URL:', scriptUrl);
      
      // Load Google Maps script dynamically
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Google Maps loaded successfully');
        initializeGoogleMaps();
      };
      
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        console.log('API Key used:', apiKey);
        setMapsError('Failed to load Google Maps. Please check your API key and ensure Places API is enabled.');
      };
      
      document.head.appendChild(script);
    }
  }, []);

  // Re-initialize autocomplete and map when form is shown
  useEffect(() => {
    if (showCreateForm && window.google && window.google.maps) {
      // Reset global map so it gets re-created with the new ref
      window.orderMap = null;
      // Small delay to ensure refs are available
      setTimeout(() => {
        initializeGoogleMaps();
      }, 200);
    }
  }, [showCreateForm]);

  // Update map when locations change
  useEffect(() => {
    if (formData.pickupLocation || formData.deliveryLocation) {
      // Delay to ensure map is initialized
      setTimeout(() => {
        updateMap();
      }, 100);
    }
  }, [formData.pickupLocation, formData.deliveryLocation]);

  // Fetch all orders for this business owner when the component mounts
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        if (!user) return;
        const token = getToken();
        const response = await fetch(`http://localhost:3001/api/orders${routeOptimizationOnly ? '?includeRouted=true' : ''}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        } else {
          setOrders([]);
        }
      } catch (err) {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
    fetchDrivers();
  }, [user]);

  const initializeGoogleMaps = () => {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps API not available');
      return;
    }
    
    console.log('Initializing Google Maps...');
    
    try {
      // Initialize autocomplete
      initializeAutocomplete();
      
      // Initialize map if not already initialized
      if (mapRef.current && !window.orderMap) {
        const defaultLocation = { lat: 14.5995, lng: 120.9842 }; // Metro Manila center
        const map = new window.google.maps.Map(mapRef.current, {
          zoom: 12,
          center: defaultLocation,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true
        });
        
        window.orderMap = map; // Store map globally for updates

        // Add live traffic layer
        const trafficLayer = new window.google.maps.TrafficLayer();
        trafficLayer.setMap(map);

        console.log('Map initialized successfully');
        
        // Update map with current locations
        if (formData.pickupLocation || formData.deliveryLocation) {
          setTimeout(() => updateMap(), 200);
        }
      } else if (window.orderMap) {
        console.log('Map already initialized');
      }
    } catch (error) {
      console.error('Error initializing Google Maps:', error);
    }
  };

  const initializeAutocomplete = () => {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps API not available for autocomplete');
      return;
    }

    console.log('Initializing autocomplete...');

    // Initialize autocomplete for pickup address
    if (pickupInputRef.current && !pickupAutocompleteRef.current) {
      try {
        pickupAutocompleteRef.current = new window.google.maps.places.Autocomplete(
          pickupInputRef.current,
          {
            types: ['address'],
            componentRestrictions: { country: 'ph' } // Restrict to Philippines
          }
        );
        
        console.log('Pickup autocomplete initialized');
        
      pickupAutocompleteRef.current.addListener('place_changed', () => {
        try {
          const place = pickupAutocompleteRef.current.getPlace();
          if (place.geometry) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            
            setFormData(prev => ({
              ...prev,
              pickupAddress: place.formatted_address,
              pickupLocation: { lat, lng }
            }));
            
            console.log('Pickup location set:', { lat, lng, address: place.formatted_address });
            
            // Update map after state update
            setTimeout(() => updateMap(), 100);
          }
        } catch (error) {
          console.error('Error handling pickup place_changed:', error);
        }
      });
      } catch (error) {
        console.error('Error initializing pickup autocomplete:', error);
      }
    }

    // Initialize autocomplete for delivery address
    if (deliveryInputRef.current && !deliveryAutocompleteRef.current) {
      try {
        deliveryAutocompleteRef.current = new window.google.maps.places.Autocomplete(
          deliveryInputRef.current,
          {
            types: ['address'],
            componentRestrictions: { country: 'ph' }
          }
        );
        
        console.log('Delivery autocomplete initialized');
        
      deliveryAutocompleteRef.current.addListener('place_changed', () => {
        try {
          const place = deliveryAutocompleteRef.current.getPlace();
          if (place.geometry) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            
            setFormData(prev => ({
              ...prev,
              dropoffAddress: place.formatted_address,
              dropoffLocation: { lat, lng }
            }));
            
            console.log('Delivery location set:', { lat, lng, address: place.formatted_address });
            
            // Update map after state update
            setTimeout(() => updateMap(), 100);
          }
        } catch (error) {
          console.error('Error handling delivery place_changed:', error);
        }
      });
      } catch (error) {
        console.error('Error initializing delivery autocomplete:', error);
      }
    }
  };

  const updateMap = () => {
    if (!window.orderMap) return;

    // Clear existing markers
    if (window.orderMarkers) {
      window.orderMarkers.forEach(marker => marker.setMap(null));
    }
    window.orderMarkers = [];

    // Clear existing route
    if (window.DirectionsRenderer) {
      window.DirectionsRenderer.setMap(null);
      window.DirectionsRenderer = null;
    }

    // Add pickup marker
    if (formData.pickupLocation) {
      const pickupMarker = new window.google.maps.Marker({
        position: formData.pickupLocation,
        map: window.orderMap,
        label: 'P',
        title: 'Pickup Location',
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
        }
      });
      window.orderMarkers.push(pickupMarker);
    }

    // Add delivery marker
    if (formData.dropoffLocation) {
      const deliveryMarker = new window.google.maps.Marker({
        position: formData.dropoffLocation,
        map: window.orderMap,
        label: 'D',
        title: 'Dropoff Location',
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        }
      });
      window.orderMarkers.push(deliveryMarker);
    }

    // Get actual road route if both locations exist
    if (formData.pickupLocation && formData.dropoffLocation) {
      getDirections(formData.pickupAddress, formData.dropoffAddress, formData.pickupLocation, formData.dropoffLocation);
    }
  };

  const getDirections = (pickupAddress, dropoffAddress, originCoords, destCoords) => {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps not available');
      return;
    }

    // Initialize Directions service if not already done
    if (!window.DirectionsService) {
      window.DirectionsService = new window.google.maps.DirectionsService();
    }

    if (!window.DirectionsRenderer) {
      window.DirectionsRenderer = new window.google.maps.DirectionsRenderer({
        map: window.orderMap,
        suppressMarkers: true,
        preserveViewport: false
      });
    }

    // Use full address strings for better street-level precision
    const origin = pickupAddress || new window.google.maps.LatLng(originCoords.lat, originCoords.lng);
    const destination = dropoffAddress || new window.google.maps.LatLng(destCoords.lat, destCoords.lng);

    console.log('Getting directions from', origin, 'to', destination);

    window.DirectionsService.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: 'bestguess'
        },
        provideRouteAlternatives: true,
        region: 'ph',
        unitSystem: window.google.maps.UnitSystem.METRIC
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          // Parse all routes and sort by shortest distance
          const allRoutes = result.routes.map((route, idx) => {
            const leg = route.legs[0];
            const durationSeconds = leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value;
            return {
              index: idx,
              summary: route.summary,
              distance_km: Math.round(leg.distance.value / 100) / 10,
              duration_minutes: Math.round(durationSeconds / 60),
              distance_text: leg.distance.text,
              duration_text: leg.duration_in_traffic ? leg.duration_in_traffic.text : leg.duration.text
            };
          }).sort((a, b) => a.distance_km - b.distance_km);

          // Display the shortest route
          window.DirectionsRenderer.setDirections(result);
          if (allRoutes[0].index !== 0) {
            window.DirectionsRenderer.setRouteIndex(allRoutes[0].index);
          }

          // Store all directionsResult for route switching
          window.currentDirectionsResult = result;

          // After first render, preserve viewport on refreshes
          if (window.DirectionsRenderer) {
            window.DirectionsRenderer.setOptions({ preserveViewport: true });
          }

          // Update form with shortest route data
          setFormData(prev => ({
            ...prev,
            routeDistance: allRoutes[0].distance_km,
            routeDuration: allRoutes[0].duration_minutes
          }));

          // Store route details and alternatives
          setRouteDetails({
            routes: allRoutes,
            summary: allRoutes[0].summary
          });
          setSelectedSingleRouteIndex(0);
          setLastTrafficUpdate(new Date());

          console.log('Route calculated:', allRoutes);
        } else {
          console.error('Directions request failed:', status);
        }
      }
    );
  };

  useEffect(() => {
    if (formData.pickupLocation || formData.dropoffLocation) {
      const timer = setTimeout(() => {
        updateMap();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [formData.pickupLocation, formData.dropoffLocation, formData.pickupAddress, formData.dropoffAddress]);

  // Auto-refresh traffic data every 15 seconds for single order route
  useEffect(() => {
    if (!formData.pickupLocation || !formData.dropoffLocation || !routeDetails) return;

    const refreshTraffic = () => {
      if (window.DirectionsService && window.DirectionsRenderer && window.orderMap) {
        const origin = formData.pickupAddress || new window.google.maps.LatLng(formData.pickupLocation.lat, formData.pickupLocation.lng);
        const destination = formData.dropoffAddress || new window.google.maps.LatLng(formData.dropoffLocation.lat, formData.dropoffLocation.lng);

        window.DirectionsService.route({
          origin, destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' },
          provideRouteAlternatives: true,
          region: 'ph',
        }, (result, status) => {
          if (status === 'OK') {
            window.currentDirectionsResult = result;
            window.DirectionsRenderer.setDirections(result);

            const allRoutes = result.routes.map((route, idx) => {
              const leg = route.legs[0];
              const dur = leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value;
              return { index: idx, summary: route.summary, distance_km: Math.round(leg.distance.value / 100) / 10, duration_minutes: Math.round(dur / 60) };
            }).sort((a, b) => a.distance_km - b.distance_km);

            const selected = allRoutes[selectedSingleRouteIndex] || allRoutes[0];
            if (selected) {
              window.DirectionsRenderer.setRouteIndex(selected.index);
              setFormData(prev => ({ ...prev, routeDistance: selected.distance_km, routeDuration: selected.duration_minutes }));
            }
            setRouteDetails(prev => ({ ...prev, routes: allRoutes }));
            setLastTrafficUpdate(new Date());
          }
        });
      }
    };

    const interval = setInterval(refreshTraffic, 15000);
    return () => clearInterval(interval);
  }, [formData.pickupLocation, formData.dropoffLocation, routeDetails?.routes?.length, selectedSingleRouteIndex]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerPhone || !/^\d{10}$/.test(formData.customerPhone)) {
      toast.error('Please enter a valid 10-digit Philippine phone number');
      return;
    }
    if (!formData.pickupAddress) {
      toast.error('Please complete the pickup address (select at least region, province, and city).');
      return;
    }
    if (!formData.dropoffAddress) {
      toast.error('Please complete the dropoff address (select at least region, province, and city).');
      return;
    }
    if (!formData.pickupLocation || !formData.pickupLocation.lat) {
      toast.error('Pickup address could not be verified. Please select a valid address with at least a city.');
      return;
    }
    if (!formData.dropoffLocation || !formData.dropoffLocation.lat) {
      toast.error('Delivery address could not be verified. Please select a valid address with at least a city.');
      return;
    }
    if (formData.pickupAddress === formData.dropoffAddress) {
      toast.error('Pickup and delivery addresses cannot be the same.');
      return;
    }

    setLoading(true);

    try {
      const token = getToken();

      // Prepare data matching database schema
      const orderData = {
        customerName: formData.customerName,
        customerPhone: `+63${formData.customerPhone}`,
        pickupAddress: formData.pickupAddress,
        deliveryAddress: formData.dropoffAddress, // map to database field
        deliveryFee: formData.deliveryFee,
        itemWeight: formData.itemWeight,
        size: formData.size,
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        distance: formData.routeDistance, // real road distance
        estimatedTime: formData.routeDuration // in minutes
      };

      const response = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const newOrder = await response.json();
        setOrders(prev => [...prev, newOrder]);
        resetForm();
        setShowCreateForm(false);
        toast.success('Order created successfully!');
      } else {
        const error = await response.json();
        console.error('Backend error:', error);
        toast.error(`Error creating order: ${error.message || error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(`Error creating order: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (loc1, loc2) => {
    const R = 6371; // Earth radius in km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      pickupAddress: '',
      dropoffAddress: '',
      pickupLocation: null,
      dropoffLocation: null,
      itemWeight: '',
      size: '',
      scheduledDate: '',
      scheduledTime: '',
      routeDistance: 0,
      routeDuration: 0,
      deliveryFee: '',
    });
    
    setRouteDetails(null);
    setSelectedSingleRouteIndex(0);

    // Clear autocomplete instances to allow re-initialization
    pickupAutocompleteRef.current = null;
    deliveryAutocompleteRef.current = null;
    
    // Clear map markers and route
    if (window.orderMarkers) {
      window.orderMarkers.forEach(marker => marker.setMap(null));
      window.orderMarkers = [];
    }
    if (window.DirectionsRenderer) {
      window.DirectionsRenderer.setMap(null);
      window.DirectionsRenderer = null;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-900 text-yellow-200',
      assigned: 'bg-blue-900 text-blue-200',
      confirmed: 'bg-blue-900 text-blue-200',
      in_transit: 'bg-purple-900 text-purple-200',
      'in-transit': 'bg-purple-900 text-purple-200',
      picked_up: 'bg-purple-900 text-purple-200',
      delayed: 'bg-orange-900 text-orange-200',
      delivered: 'bg-teal-900 text-teal-200',
      completed: 'bg-green-900 text-green-200',
      cancelled: 'bg-red-900 text-red-200'
    };
    return colors[status?.toLowerCase()] || 'bg-gray-900 text-gray-200';
  };

  useEffect(() => {
    const loadScript = (url, onLoad) => {
      if (document.querySelector(`script[src='${url}']`)) {
        onLoad();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = onLoad;
      document.head.appendChild(script);
    };

    // Show map whenever selectedOrder changes
    const showMapForOrder = async () => {
      if (!selectedOrder || !orderDetailMapRef.current) return;
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      if (!apiKey) return;
      const initialize = async () => {
        // Geocode address ⇒ lat/lng if missing
        const geocode = async (address) => {
          return new Promise(resolve => {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ address }, (results, status) => {
              if (status === 'OK') {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
              } else {
                resolve(null);
              }
            });
          });
        };

        let pickupLatLng = selectedOrder.pickup_latlng || null;
        let dropoffLatLng = selectedOrder.dropoff_latlng || null;
        if (!pickupLatLng && selectedOrder.pickup_location) {
          pickupLatLng = await geocode(selectedOrder.pickup_location);
        }
        if (!dropoffLatLng && selectedOrder.drop_off_location) {
          dropoffLatLng = await geocode(selectedOrder.drop_off_location);
        }
        // Clear old map
        orderDetailMapRef.current.innerHTML = '';
        if (!pickupLatLng || !dropoffLatLng) return;
        const map = new window.google.maps.Map(orderDetailMapRef.current, {
          zoom: 12,
          center: pickupLatLng,
        });
        // Add live traffic layer
        const trafficLayer = new window.google.maps.TrafficLayer();
        trafficLayer.setMap(map);
        // Add markers
        new window.google.maps.Marker({
          position: pickupLatLng,
          map,
          label: 'P', title: 'Pickup', icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
          }
        });
        new window.google.maps.Marker({
          position: dropoffLatLng,
          map,
          label: 'D', title: 'Dropoff', icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
          }
        });
        // Show route with real-time traffic and alternatives
        const ds = new window.google.maps.DirectionsService();
        const dr = new window.google.maps.DirectionsRenderer({ map, suppressMarkers: true });
        window.orderDetailDR = dr;
        ds.route({
          origin: pickupLatLng,
          destination: dropoffLatLng,
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' },
          provideRouteAlternatives: true,
          region: 'ph',
        }, (result, status) => {
          if (status === 'OK') {
            dr.setDirections(result);
            window.orderDetailDirectionsResult = result;

            const allRoutes = result.routes.map((route, idx) => {
              const leg = route.legs[0];
              const dur = leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value;
              return { index: idx, summary: route.summary, distance_km: Math.round(leg.distance.value / 100) / 10, duration_minutes: Math.round(dur / 60) };
            }).sort((a, b) => a.distance_km - b.distance_km);

            // Show shortest route
            if (allRoutes[0].index !== 0) dr.setRouteIndex(allRoutes[0].index);
            dr.setOptions({ preserveViewport: true });

            setOrderRouteDetails({ routes: allRoutes });
            setSelectedOrderRouteIndex(0);
          }
        });
      };

      if (!(window.google && window.google.maps)) {
        loadScript(`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places` , initialize);
      } else {
        initialize();
      }
    };
    showMapForOrder();
    // Fetch tracking log when order is selected
    if (selectedOrder) {
      fetchStatusLog(selectedOrder.order_id);
      setShowMoreDetails(false);
    }
  }, [selectedOrder]);

  // Auto-refresh traffic for order detail view every 15 seconds
  useEffect(() => {
    if (!selectedOrder || !selectedOrder.pickup_location || !selectedOrder.drop_off_location) return;
    if (!window.orderDetailDR) return;

    const refreshOrderTraffic = () => {
      if (!window.google || !window.google.maps) return;
      const ds = new window.google.maps.DirectionsService();
      ds.route({
        origin: selectedOrder.pickup_location,
        destination: selectedOrder.drop_off_location,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' },
        provideRouteAlternatives: true,
        region: 'ph',
      }, (result, status) => {
        if (status === 'OK' && window.orderDetailDR) {
          window.orderDetailDirectionsResult = result;
          window.orderDetailDR.setOptions({ preserveViewport: true });
          window.orderDetailDR.setDirections(result);

          const allRoutes = result.routes.map((route, idx) => {
            const leg = route.legs[0];
            const dur = leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value;
            return { index: idx, summary: route.summary, distance_km: Math.round(leg.distance.value / 100) / 10, duration_minutes: Math.round(dur / 60) };
          }).sort((a, b) => a.distance_km - b.distance_km);

          const selected = allRoutes[selectedOrderRouteIndex] || allRoutes[0];
          if (selected) window.orderDetailDR.setRouteIndex(selected.index);
          setOrderRouteDetails({ routes: allRoutes });
        }
      });
    };

    const interval = setInterval(refreshOrderTraffic, 15000);
    return () => clearInterval(interval);
  }, [selectedOrder?.order_id, selectedOrderRouteIndex]);

  // Show optimization route map
  useEffect(() => {
    if (!optimizationResult || !optimizationMapRef.current) return;
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) return;

    const initialize = async () => {
      const geocode = (address) => {
        return new Promise(resolve => {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK') {
              const loc = results[0].geometry.location;
              resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
              resolve(null);
            }
          });
        });
      };

      const stops = optimizationResult.optimized_order || [];
      if (stops.length < 2) return;

      // Geocode all stops
      const coords = [];
      for (const stop of stops) {
        const loc = await geocode(stop.drop_off_location);
        if (loc) coords.push({ ...stop, ...loc });
      }
      if (coords.length < 2) return;

      optimizationMapRef.current.innerHTML = '';
      const map = new window.google.maps.Map(optimizationMapRef.current, {
        zoom: 12,
        center: coords[0],
      });

      // Add live traffic layer
      const trafficLayer = new window.google.maps.TrafficLayer();
      trafficLayer.setMap(map);

      // Add numbered markers
      coords.forEach((c, i) => {
        new window.google.maps.Marker({
          position: { lat: c.lat, lng: c.lng },
          map,
          label: { text: String(i + 1), color: 'white', fontWeight: 'bold' },
          title: `Stop ${i + 1}: ${c.drop_off_location}`,
        });
      });

      // Draw route through waypoints with real-time traffic
      const ds = new window.google.maps.DirectionsService();
      const dr = new window.google.maps.DirectionsRenderer({ map, suppressMarkers: true });
      const waypoints = coords.slice(1, -1).map(c => ({
        location: { lat: c.lat, lng: c.lng },
        stopover: true
      }));

      ds.route({
        origin: { lat: coords[0].lat, lng: coords[0].lng },
        destination: { lat: coords[coords.length - 1].lat, lng: coords[coords.length - 1].lng },
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: 'bestguess'
        },
        region: 'ph',
      }, (result, status) => {
        if (status === 'OK') dr.setDirections(result);
      });
    };

    if (!(window.google && window.google.maps)) {
      const url = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      if (!document.querySelector(`script[src='${url}']`)) {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = initialize;
        document.head.appendChild(script);
      } else {
        initialize();
      }
    } else {
      initialize();
    }
  }, [optimizationResult]);

  // Helper to render a single order card
  const renderOrderCard = (order, borderColor = 'gray-700', hoverColor = 'gray-500') => (
    <div
      key={order.order_id}
      className={`bg-gray-800 rounded-lg border border-${borderColor} p-6 hover:border-${hoverColor} transition-colors cursor-pointer group ${(selectedOrder && selectedOrder.order_id === order.order_id) ? 'ring-2 ring-blue-400' : ''}`}
      onClick={() => !showCreateForm && setSelectedOrder(order)}
      tabIndex={0}
      role="button"
      aria-label={`View Order ${order.order_id}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-3">
            {order.route_sequence && (
              <span className="w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {order.route_sequence}
              </span>
            )}
            <h4 className="text-lg font-semibold text-white">{order.customer_name || 'Customer'}</h4>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.order_status)}`}>
              {order.order_status}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <p className="text-gray-400">Pickup:</p>
              <p className="text-white">{order.pickup_location}</p>
            </div>
            <div>
              <p className="text-gray-400">Delivery:</p>
              <p className="text-white">{order.drop_off_location}</p>
            </div>
            <div>
              <p className="text-gray-400">Weight:</p>
              <p className="text-white">{order.weight} kg</p>
            </div>
            {order.size && (
              <div>
                <p className="text-gray-400">Size:</p>
                <p className="text-white">{order.size}</p>
              </div>
            )}
            {order.scheduled_delivery_time && (
              <div>
                <p className="text-gray-400">Scheduled:</p>
                <p className="text-white">{new Date(order.scheduled_delivery_time).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setSelectedOrder(selectedOrder?.order_id === order.order_id ? null : order); }}
          className="ml-4 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          tabIndex={-1}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );

  // Group rendering refactored into function
  const renderGroupedOrders = () => {
    // Separate route-grouped orders from individual orders
    const routeGroups = {};
    const individualOrders = [];

    orders.forEach(order => {
      if (order.route_id && order.route_sequence) {
        if (!routeGroups[order.route_id]) routeGroups[order.route_id] = [];
        routeGroups[order.route_id].push(order);
      } else {
        individualOrders.push(order);
      }
    });

    // Sort each route group by sequence
    Object.keys(routeGroups).forEach(routeId => {
      routeGroups[routeId].sort((a, b) => a.route_sequence - b.route_sequence);
    });

    // Grouping logic for individual orders
    const today = new Date();
    const previousMap = {};
    const todayOrders = [];
    const upcomingMap = {};
    individualOrders.forEach(order => {
      if (order.scheduled_delivery_time) {
        const d = parseISO(order.scheduled_delivery_time);
        const dateKey = format(d, "yyyy-MM-dd");
        if (isToday(d)) {
          todayOrders.push(order);
        } else if (isAfter(d, today)) {
          if (!upcomingMap[dateKey]) upcomingMap[dateKey] = [];
          upcomingMap[dateKey].push(order);
        } else { // before today
          if (!previousMap[dateKey]) previousMap[dateKey] = [];
          previousMap[dateKey].push(order);
        }
      }
    });
    const previousDates = Object.keys(previousMap).sort().reverse();
    const upcomingDates = Object.keys(upcomingMap).sort();
    const routeIds = Object.keys(routeGroups);
    return (
      <div className="space-y-8">
        {/* Optimized Routes - hidden from delivery orders, shown via dedicated block in route optimization */}
        {false && routeIds.length > 0 && (
          <div>
            <h4 className="text-xl font-semibold text-purple-400 mb-4">Optimized Routes</h4>
            {routeIds.map(routeId => {
              const routeOrders = routeGroups[routeId];
              const driverName = routeOrders[0]?.driver_name;
              const allCompleted = routeOrders.every(o => o.order_status === 'completed');
              const completedCount = routeOrders.filter(o => o.order_status === 'completed').length;
              return (
                <div key={routeId} className="mb-6 border border-purple-500/30 rounded-xl p-4 bg-gray-900/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="text-purple-300 font-semibold">Route #{routeId}</span>
                      <span className="text-gray-400 text-sm">({routeOrders.length} stops)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {driverName && (
                        <span className="text-sm text-blue-400">Driver: {driverName}</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${allCompleted ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-300'}`}>
                        {allCompleted ? 'Route Complete' : `${completedCount}/${routeOrders.length} completed`}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {routeOrders.map(order => renderOrderCard(order))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Individual Orders */}
        {previousDates.length > 0 && (
          <div>
            <h4 className="text-xl font-semibold text-gray-400 mb-4">Previous Orders</h4>
            {previousDates.map(dateStr => (
              <div key={dateStr}>
                <h5 className="text-lg font-semibold text-gray-400 mb-2">{format(parseISO(dateStr), 'MMMM d, yyyy')}</h5>
                <div className="grid grid-cols-1 gap-4">
                  {previousMap[dateStr].map(order => renderOrderCard(order))}
                </div>
              </div>
            ))}
          </div>
        )}
        {todayOrders.length > 0 && (
          <div>
            <h4 className="text-xl font-semibold text-blue-400 mb-4">Today</h4>
            <div className="grid grid-cols-1 gap-4">
              {todayOrders.map(order => renderOrderCard(order))}
            </div>
          </div>
        )}
        {upcomingDates.map(dateStr => (
          <div key={dateStr}>
            <h4 className="text-xl font-semibold text-yellow-400 mb-4">{format(parseISO(dateStr), 'MMMM d, yyyy')}</h4>
            <div className="grid grid-cols-1 gap-4">
              {upcomingMap[dateStr].map(order => renderOrderCard(order))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Google Maps in edit mode for preview
  useEffect(() => {
    if (!editMode) return;
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const loadScript = (url, onLoad) => {
      if (document.querySelector(`script[src='${url}']`)) {
        onLoad(); return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = onLoad;
      document.head.appendChild(script);
    };
    const showEditMap = async () => {
      if (!orderDetailMapRef.current) return;
      const initialize = async () => {
        const geocode = async (address) => new Promise(resolve => {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK') {
              const loc = results[0].geometry.location;
              resolve({ lat: loc.lat(), lng: loc.lng() });
            } else resolve(null);
          });
        });
        let pi = editFields.pickup_location ? await geocode(editFields.pickup_location) : null;
        let di = editFields.drop_off_location ? await geocode(editFields.drop_off_location) : null;
        orderDetailMapRef.current.innerHTML = '';
        if (!pi || !di) return;
        const map = new window.google.maps.Map(orderDetailMapRef.current, { zoom: 12, center: pi });
        const trafficLayer = new window.google.maps.TrafficLayer();
        trafficLayer.setMap(map);
        new window.google.maps.Marker({ position: pi, map, label: 'P', title: 'Pickup', icon: { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' }});
        new window.google.maps.Marker({ position: di, map, label: 'D', title: 'Dropoff', icon: { url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }});
        const ds = new window.google.maps.DirectionsService();
        const dr = new window.google.maps.DirectionsRenderer({ map, suppressMarkers: true });
        ds.route({ origin: pi, destination: di, travelMode: window.google.maps.TravelMode.DRIVING, drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' }, region: 'ph' }, (result, status) => {
          if (status === 'OK') dr.setDirections(result);
        });
      };

      if (!(window.google && window.google.maps)) {
        loadScript(`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`, initialize);
      } else {
        initialize();
      }
    };
    showEditMap();
    // rerun on field changes in edit mode
  }, [editMode, editFields.pickup_location, editFields.drop_off_location]);


  return (
    <div className="space-y-6">
      {/* Header */}
      {!routeOptimizationOnly && (
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Orders Management</h2>
            <p className="mt-1 text-gray-300">Create and manage delivery orders</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {showCreateForm ? 'Cancel' : 'Create New Order'}
          </button>
        </div>
      )}

      {/* Create Order Form */}
      {!routeOptimizationOnly && showCreateForm && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-xl font-bold text-white mb-6">Create New Order</h3>
          
          {/* Error Display */}
          {mapsError && (
            <div className="mb-4 bg-red-900 border border-red-700 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-200">Google Maps Error</h3>
                  <div className="mt-2 text-sm text-red-300">
                    <p>{mapsError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Information */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Customer Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="customerName" className="block text-sm font-medium text-gray-300 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    id="customerName"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                  />
                </div>
                <div>
                  <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number *
                  </label>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-3 py-2 border border-gray-600 rounded-md bg-gray-600 text-gray-300 sm:text-sm">
                      +63
                    </span>
                    <input
                      type="tel"
                      id="customerPhone"
                      name="customerPhone"
                      value={formData.customerPhone}
                      onChange={handleInputChange}
                      required
                      placeholder="9171234567"
                      className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address Selection with Cascading Dropdowns */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Delivery Addresses</h4>
              <p className="text-sm text-gray-400 mb-4">Select region, province, then city to set the address. Add a street or barangay for more precision.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-700/50">
                  <CascadingAddressSelector
                    label="Pickup Address"
                    value={formData.pickupAddress}
                    onChange={(address) => setFormData(prev => ({ ...prev, pickupAddress: address }))}
                    onLocationResolved={(loc) => setFormData(prev => ({ ...prev, pickupLocation: loc }))}
                    required
                  />
                </div>
                <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-700/50">
                  <CascadingAddressSelector
                    label="Dropoff Address"
                    value={formData.dropoffAddress}
                    onChange={(address) => setFormData(prev => ({ ...prev, dropoffAddress: address }))}
                    onLocationResolved={(loc) => setFormData(prev => ({ ...prev, dropoffLocation: loc }))}
                    required
                  />
                </div>
              </div>

              {/* Google Maps Display */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-gray-300">Route Preview</h5>
                  {formData.routeDistance > 0 && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-blue-400">
                        {formData.routeDistance.toFixed(1)} km
                      </span>
                      {formData.routeDuration > 0 && (
                        <span className="text-green-400">
                          {formData.routeDuration} min
                        </span>
                      )}
                      {routeDetails && (
                        <span className="text-green-400 text-xs animate-pulse">● Live traffic</span>
                      )}
                      {lastTrafficUpdate && (
                        <span className="text-gray-500 text-[10px]">Updated: {lastTrafficUpdate.toLocaleTimeString()}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Route summary and alternatives */}
                {routeDetails && routeDetails.routes.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {routeDetails.routes.map((route, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedSingleRouteIndex(i);
                          setFormData(prev => ({ ...prev, routeDistance: route.distance_km, routeDuration: route.duration_minutes }));
                          if (window.DirectionsRenderer && window.currentDirectionsResult) {
                            window.DirectionsRenderer.setRouteIndex(route.index);
                          }
                        }}
                        className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-colors ${
                          selectedSingleRouteIndex === i
                            ? 'bg-blue-600/20 border-blue-500 text-white'
                            : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {selectedSingleRouteIndex === i && <span className="text-blue-400">✓</span>}
                          {i === 0 ? '⚡ Shortest' : route.summary || `Alt ${i}`}
                          {i === 0 && <span className="text-[9px] bg-green-600/30 text-green-400 px-1 rounded">Recommended</span>}
                        </span>
                        <span className="font-medium">{route.distance_km} km · {route.duration_minutes} min</span>
                      </button>
                    ))}
                  </div>
                )}

                <div
                  ref={mapRef}
                  className="w-full h-80 rounded-md border border-gray-600"
                />
                {formData.pickupLocation && formData.dropoffLocation && (
                  <p className="mt-2 text-xs text-green-400">Both locations set — route shown above</p>
                )}
              </div>
            </div>

            {/* Item Information */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Item Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="itemWeight" className="block text-sm font-medium text-gray-300 mb-2">
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="itemWeight"
                    name="itemWeight"
                    value={formData.itemWeight}
                    onChange={handleInputChange}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                  />
                </div>
                <div>
                  <label htmlFor="size" className="block text-sm font-medium text-gray-300 mb-2">
                    Size
                  </label>
                  <select
                    id="size"
                    name="size"
                    value={formData.size}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                  >
                    <option value="">Select size</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-300 mb-2">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  id="scheduledDate"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                />
              </div>
              <div>
                <label htmlFor="scheduledTime" className="block text-sm font-medium text-gray-300 mb-2">
                  Scheduled Time
                </label>
                <input
                  type="time"
                  id="scheduledTime"
                  name="scheduledTime"
                  value={formData.scheduledTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                />
              </div>
            </div>

            {/* Delivery Fee and Commission */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="deliveryFee" className="block text-sm font-medium text-gray-300 mb-2">
                  Delivery Fee (₱) *
                </label>
                <input
                  type="number"
                  id="deliveryFee"
                  name="deliveryFee"
                  value={formData.deliveryFee}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Commission (₱)
                </label>
                <div className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-white text-sm text-gray-300">
                  10.00
                </div>
              </div>
            </div>


            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Route Optimization */}
      <div className="mb-6">
        {routeOptimizationOnly ? (
          <div className="flex justify-center mb-6">
            <button
              onClick={() => { setShowOptimize(!showOptimize); setOptimizationResult(null); setSelectedForOptimize([]); }}
              className={`px-6 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                showOptimize ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              {showOptimize ? 'Cancel Optimization' : 'Optimize Routes'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
          </div>
        )}

        {showOptimize && (
          <div className="bg-gray-800 border border-purple-500/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-300 mb-3">Select orders to include in route optimization (minimum 2):</p>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {orders.filter(o => (o.order_status === 'pending' || o.order_status === 'assigned') && !o.route_id).map(order => (
                <label key={order.order_id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedForOptimize.includes(order.order_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedForOptimize(prev => [...prev, order.order_id]);
                      } else {
                        setSelectedForOptimize(prev => prev.filter(id => id !== order.order_id));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500"
                  />
                  <span className="text-white text-sm font-medium">#{order.order_id} - {order.customer_name || 'Unknown'}</span>
                  <span className="text-gray-400 text-xs truncate flex-1">
                    <span className="text-green-400">Pickup:</span> {order.pickup_location || 'N/A'}
                    <span className="mx-1">→</span>
                    <span className="text-red-400">Dropoff:</span> {order.drop_off_location}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOptimizeRoutes}
                disabled={optimizing || selectedForOptimize.length < 2}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {optimizing ? 'Optimizing...' : `Optimize ${selectedForOptimize.length} Orders`}
              </button>
              <span className="text-xs text-gray-400">{selectedForOptimize.length} selected</span>
            </div>

            {optimizationResult && (
              <div className="mt-4 p-3 bg-gray-900 rounded-lg border border-green-500/30">
                <h4 className="text-green-400 font-medium text-sm mb-2">Optimized Route Order:</h4>
                <div className="space-y-2">
                  {optimizationResult.optimized_order.map((stop) => (
                    <div key={stop.order_id} className="flex items-start gap-2 text-sm p-2 bg-gray-800/50 rounded">
                      <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {stop.sequence}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium">#{stop.order_id} - {stop.customer_name}</div>
                        <div className="text-xs text-gray-400 truncate">
                          <span className="text-green-400">Pickup:</span> {stop.pickup_location || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          <span className="text-red-400">Dropoff:</span> {stop.drop_off_location}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Route Selection */}
                {(() => {
                  const allRoutes = [
                    optimizationResult.eta ? { ...optimizationResult.eta, distance_km: optimizationResult.estimated_distance_km, label: 'Shortest Route' } : null,
                    ...(optimizationResult.alternative_routes || []).map((alt, i) => ({ ...alt, label: alt.summary || `Alternative ${i + 1}` }))
                  ].filter(Boolean);
                  const selected = allRoutes[selectedRouteIndex] || allRoutes[0];

                  return (
                    <>
                      {/* Stats for selected route */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">Stops</p>
                          <p className="text-sm font-bold text-white">{optimizationResult.total_stops}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">Distance</p>
                          <p className="text-sm font-bold text-white">{selected?.distance_km || optimizationResult.estimated_distance_km} km</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">ETA (Real-time)</p>
                          <p className="text-sm font-bold text-white">
                            {selected?.duration_traffic_minutes ? `${selected.duration_traffic_minutes} min` : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Route info for selected route */}
                      {selected && (
                        <div className="mt-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">Route:</span>
                            <span className="text-white font-medium">{selected.summary || 'Via optimized path'}</span>
                            <span className="text-green-400 text-[10px] animate-pulse">● Live traffic</span>
                          </div>
                          {selected.legs && selected.legs.length > 1 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-[10px] text-gray-500 uppercase">Leg Breakdown:</p>
                              {selected.legs.map((leg, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                  <span className="w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0">{i + 1}</span>
                                  <span className="truncate flex-1">{leg.distance} &middot; {leg.duration_traffic}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Route selection buttons */}
                      {allRoutes.length > 1 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] text-gray-500 uppercase">Select Route:</p>
                          {allRoutes.map((route, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedRouteIndex(i)}
                              className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-colors ${
                                selectedRouteIndex === i
                                  ? 'bg-blue-600/20 border-blue-500 text-white'
                                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {selectedRouteIndex === i && <span className="text-blue-400">✓</span>}
                                {i === 0 ? '⚡ Shortest Route' : route.label}
                                {i === 0 && <span className="text-[9px] bg-green-600/30 text-green-400 px-1 rounded">Recommended</span>}
                              </span>
                              <span className="font-medium">{route.distance_km} km &middot; {route.duration_traffic_minutes} min</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                <div ref={optimizationMapRef} style={{ width: '100%', height: 350, borderRadius: 8, border: '1px solid #334155', background: '#232946', marginTop: 12 }} />

                {/* Assign Driver to Route */}
                <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-blue-500/30">
                  <h5 className="text-blue-400 font-medium text-sm mb-2">Assign Driver to Entire Route</h5>
                  <div className="flex items-center gap-3">
                    <select
                      id="routeDriverSelect"
                      className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm"
                      defaultValue=""
                    >
                      <option value="">-- Select Driver --</option>
                      {availableDrivers.map(d => (
                        <option key={d.driver_id} value={d.driver_id}>
                          {d.first_name} {d.last_name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={async () => {
                        const driverId = document.getElementById('routeDriverSelect').value;
                        if (!driverId) {
                          toast.error('Please select a driver');
                          return;
                        }
                        try {
                          const token = getToken();
                          const orderIds = optimizationResult.optimized_order.map(s => s.order_id);
                          const res = await fetch('http://localhost:3001/api/routes/assign-driver', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({
                              routeId: optimizationResult.optimization_id,
                              driverId: parseInt(driverId),
                              orderIds
                            })
                          });
                          if (res.ok) {
                            const data = await res.json();
                            toast.success(`Driver assigned to ${orderIds.length} orders in optimized route!`);
                            // Clear optimization result and refresh orders
                            setOptimizationResult(null);
                            setSelectedRouteIndex(0);
                            const ordersRes = await fetch(`http://localhost:3001/api/orders${routeOptimizationOnly ? '?includeRouted=true' : ''}`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (ordersRes.ok) setOrders(await ordersRes.json());
                          } else {
                            const err = await res.json();
                            toast.error(err.error || 'Failed to assign driver to route');
                          }
                        } catch (err) {
                          toast.error('Failed to assign driver to route');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Assign to Route
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Show only optimized routes in route optimization mode */}
      {routeOptimizationOnly && (() => {
        const routeGroups = {};
        orders.forEach(order => {
          if (order.route_id && order.route_sequence) {
            if (!routeGroups[order.route_id]) routeGroups[order.route_id] = [];
            routeGroups[order.route_id].push(order);
          }
        });
        Object.values(routeGroups).forEach(g => g.sort((a, b) => a.route_sequence - b.route_sequence));
        const routeIds = Object.keys(routeGroups);
        if (routeIds.length === 0) return (
          <div className="text-center py-10">
            <svg className="mx-auto h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3 className="mt-3 text-sm font-medium text-gray-300">No optimized routes yet</h3>
            <p className="mt-1 text-xs text-gray-500">Select orders above and click Optimize to create routes.</p>
          </div>
        );
        return (
          <div className="space-y-4">
            <h4 className="text-xl font-semibold text-purple-400">Optimized Routes</h4>
            {routeIds.map(routeId => {
              const routeOrders = routeGroups[routeId];
              const driverName = routeOrders[0]?.driver_name;
              const allCompleted = routeOrders.every(o => o.order_status === 'completed');
              const completedCount = routeOrders.filter(o => o.order_status === 'completed').length;
              return (
                <div key={routeId} className="border border-purple-500/30 rounded-xl p-4 bg-gray-900/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="text-purple-300 font-semibold">Route #{routeId}</span>
                      <span className="text-gray-400 text-sm">({routeOrders.length} stops)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {driverName && <span className="text-sm text-blue-400">Driver: {driverName}</span>}
                      <span className={`text-xs px-2 py-1 rounded-full ${allCompleted ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-300'}`}>
                        {allCompleted ? 'Route Complete' : `${completedCount}/${routeOrders.length} completed`}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {routeOrders.map(order => renderOrderCard(order))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Order Detail View - Slide-in side panel */}
      {selectedOrder && (
        <div className="fixed top-0 right-0 w-full lg:w-[55%] h-full bg-black/50 lg:bg-transparent z-40" onClick={(e) => { if (e.target === e.currentTarget) { setSelectedOrder(null); setEditMode(false); setEditFields({}); setOrderRouteDetails(null); setSelectedOrderRouteIndex(0); }}}>
          <div ref={orderDetailRef} className="ml-auto w-full lg:w-full h-full overflow-y-auto bg-gray-900 border-l border-blue-500 p-6 shadow-2xl">
            <button
              onClick={() => { setSelectedOrder(null); setEditMode(false); setEditFields({}); setOrderRouteDetails(null); setSelectedOrderRouteIndex(0); }}
              className="mb-3 text-blue-400 hover:text-blue-200 text-sm inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
            {!editMode ? (
              <>
                <div className="flex gap-2 mb-4">
                  <button
                    className="px-4 py-1 bg-green-700 text-green-100 rounded hover:bg-green-600 transition-colors"
                    onClick={() => { setEditMode(true); setEditFields({ ...selectedOrder }); }}
                  >Edit</button>
                  <button
                    className="px-4 py-1 bg-red-700 text-red-100 rounded hover:bg-red-600 transition-colors"
                    onClick={() => setDeleting(true)}
                  >Delete</button>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Order #{selectedOrder.order_id}</h2>

                {/* Driver Assignment */}
                <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Assign Driver</label>
                  <select
                    className="w-full px-2 py-1.5 rounded border border-gray-600 bg-gray-700 text-white text-sm"
                    value={selectedOrder.assigned_driver_id || ''}
                    onChange={(e) => handleAssignDriver(selectedOrder.order_id, e.target.value ? parseInt(e.target.value) : null)}
                    disabled={assigningDriver}
                  >
                    <option value="">-- No Driver --</option>
                    {availableDrivers.map(d => (
                      <option key={d.driver_id} value={d.driver_id}>
                        {d.first_name} {d.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Update */}
                <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                  {(() => {
                    const validTransitions = {
                      pending: ['assigned', 'cancelled'],
                      assigned: ['in_transit', 'cancelled'],
                      in_transit: ['delivered', 'cancelled', 'delayed'],
                      delayed: ['in_transit', 'delivered', 'cancelled'],
                      delivered: ['completed'],
                      completed: [],
                      cancelled: []
                    };
                    const statusFlow = ['pending', 'assigned', 'in_transit', 'delivered', 'completed'];
                    const statusLabels = {
                      pending: 'Pending', assigned: 'Assigned', in_transit: 'In Transit',
                      delayed: 'Delayed', delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled'
                    };
                    const statusColors = {
                      pending: 'bg-yellow-500', assigned: 'bg-blue-500', in_transit: 'bg-purple-500',
                      delayed: 'bg-orange-500', delivered: 'bg-teal-500', completed: 'bg-green-500', cancelled: 'bg-red-500'
                    };
                    const currentIdx = statusFlow.indexOf(selectedOrder.order_status);
                    const isCancelled = selectedOrder.order_status === 'cancelled';
                    const allowed = validTransitions[selectedOrder.order_status] || [];

                    return (
                      <>
                        {/* Progress tracker */}
                        <div className="flex items-center justify-between mb-4 overflow-x-auto">
                          {statusFlow.map((s, i) => {
                            const isActive = s === selectedOrder.order_status && !isCancelled;
                            const isPast = !isCancelled && currentIdx >= 0 && i < currentIdx;
                            return (
                              <div key={s} className="flex items-center flex-1 min-w-0">
                                <div className="flex flex-col items-center">
                                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold border-2 transition-all ${
                                    isActive ? `${statusColors[s]} border-white text-white shadow-lg shadow-${s === 'completed' ? 'green' : 'blue'}-500/30` :
                                    isPast ? 'bg-green-600 border-green-400 text-white' :
                                    'bg-gray-700 border-gray-600 text-gray-500'
                                  }`}>
                                    {isPast ? '✓' : i + 1}
                                  </div>
                                  <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-white' : isPast ? 'text-green-400' : 'text-gray-500'}`}>
                                    {statusLabels[s]}
                                  </span>
                                </div>
                                {i < statusFlow.length - 1 && (
                                  <div className={`flex-1 h-0.5 mx-1 mt-[-12px] ${isPast || (isActive && i < currentIdx) ? 'bg-green-500' : 'bg-gray-700'}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Cancelled banner */}
                        {isCancelled && (
                          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-900/40 border border-red-700 rounded-lg">
                            <span className="text-red-400 text-lg">✕</span>
                            <span className="text-red-300 text-sm font-medium">This order has been cancelled</span>
                          </div>
                        )}

                        {/* Current status + action buttons */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Current:</span>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(selectedOrder.order_status)}`}>
                              {statusLabels[selectedOrder.order_status] || selectedOrder.order_status}
                            </span>
                          </div>
                          {allowed.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {allowed.filter(s => s !== 'cancelled').map(s => (
                                <button
                                  key={s}
                                  className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${statusColors[s]} hover:opacity-90 text-white shadow-md disabled:opacity-50`}
                                  onClick={() => handleStatusChange(selectedOrder.order_id, s)}
                                  disabled={updatingStatus}
                                >
                                  → {statusLabels[s]}
                                </button>
                              ))}
                              {allowed.includes('cancelled') && (
                                <button
                                  className="px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all bg-red-800 hover:bg-red-700 text-red-200 border border-red-600 disabled:opacity-50"
                                  onClick={() => handleStatusChange(selectedOrder.order_id, 'cancelled')}
                                  disabled={updatingStatus}
                                >
                                  Cancel Order
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 italic">No further actions</span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 gap-2 text-gray-200 text-sm mb-6 break-words">
                  <div><b>Status:</b> <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.order_status)}`}>{selectedOrder.order_status}</span></div>
                  <div><b>Customer:</b> {selectedOrder.customer_name}</div>
                  <div><b>Pickup:</b> {selectedOrder.pickup_location}</div>
                  <div><b>Dropoff:</b> {selectedOrder.drop_off_location}</div>
                  <div><b>Driver:</b> {selectedOrder.driver_name || '—'}</div>
                  <div><b>Scheduled:</b> {selectedOrder.scheduled_delivery_time ? new Date(selectedOrder.scheduled_delivery_time).toLocaleString() : '—'}</div>
                  <div><b>Delivery Fee:</b> {selectedOrder.delivery_fee ? `₱${Number(selectedOrder.delivery_fee).toFixed(2)}` : '—'}</div>
                  {showMoreDetails ? (
                    <>
                      <div><b>Phone:</b> {selectedOrder.customer_phone}</div>
                      <div><b>Weight:</b> {selectedOrder.weight} kg</div>
                      <div><b>Size:</b> {selectedOrder.size || 'N/A'}</div>
                      <div><b>Created at:</b> {selectedOrder.order_created_at ? new Date(selectedOrder.order_created_at).toLocaleString() : '—'}</div>
                      <div><b>Commission:</b> ₱10.00</div>
                      <button onClick={() => setShowMoreDetails(false)} className="text-blue-400 text-xs hover:text-blue-300 mt-1">Show less</button>
                    </>
                  ) : (
                    <button onClick={() => setShowMoreDetails(true)} className="text-blue-400 text-xs hover:text-blue-300 mt-1">Show more details</button>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-sm text-blue-400 font-semibold flex items-center gap-2">
                    Route Preview:
                    {orderRouteDetails && <span className="text-green-400 text-xs animate-pulse">● Live traffic</span>}
                  </div>

                  {/* Stats cards */}
                  {orderRouteDetails && orderRouteDetails.routes.length > 0 && (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">Distance</p>
                          <p className="text-sm font-bold text-white">{orderRouteDetails.routes[selectedOrderRouteIndex]?.distance_km} km</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">ETA (Real-time)</p>
                          <p className="text-sm font-bold text-white">{orderRouteDetails.routes[selectedOrderRouteIndex]?.duration_minutes} min</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">Route</p>
                          <p className="text-sm font-bold text-white truncate">{orderRouteDetails.routes[selectedOrderRouteIndex]?.summary || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Route selection */}
                      {orderRouteDetails.routes.length > 1 && (
                        <div className="mb-2 space-y-1">
                          <p className="text-[10px] text-gray-500 uppercase">Select Route:</p>
                          {orderRouteDetails.routes.map((route, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setSelectedOrderRouteIndex(i);
                                if (window.orderDetailDR && window.orderDetailDirectionsResult) {
                                  window.orderDetailDR.setRouteIndex(route.index);
                                }
                              }}
                              className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-colors ${
                                selectedOrderRouteIndex === i
                                  ? 'bg-blue-600/20 border-blue-500 text-white'
                                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {selectedOrderRouteIndex === i && <span className="text-blue-400">✓</span>}
                                {i === 0 ? '⚡ Shortest' : route.summary || `Alt ${i}`}
                                {i === 0 && <span className="text-[9px] bg-green-600/30 text-green-400 px-1 rounded">Recommended</span>}
                              </span>
                              <span className="font-medium">{route.distance_km} km · {route.duration_minutes} min</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div ref={orderDetailMapRef} style={{ width: '100%', height: 320, borderRadius: 8, border: '1px solid #334155', background: '#232946' }} />
                  {(!selectedOrder.pickup_location || !selectedOrder.drop_off_location) && (
                    <div className="mt-3 text-sm text-gray-400">No map data available for this order.</div>
                  )}
                </div>

                {/* Tracking Timeline */}
                <div className="mt-6">
                  <div className="mb-2 text-sm text-blue-400 font-semibold">Delivery Status Timeline:</div>
                  {loadingLog ? (
                    <div className="text-gray-400 text-sm animate-pulse">Loading timeline...</div>
                  ) : statusLog.length > 0 ? (
                    <div className="relative pl-6 space-y-3">
                      {statusLog.map((log, idx) => (
                        <div key={log.status_log_id || idx} className="relative">
                          <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 ${
                            idx === statusLog.length - 1
                              ? 'bg-blue-500 border-blue-400'
                              : 'bg-gray-600 border-gray-500'
                          }`} />
                          {idx < statusLog.length - 1 && (
                            <div className="absolute -left-[18px] top-4 w-0.5 h-full bg-gray-700" />
                          )}
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${
                              idx === statusLog.length - 1 ? 'text-blue-300' : 'text-gray-300'
                            }`}>
                              {log.status?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                            <span className="text-xs text-gray-500">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">No status updates recorded yet.</div>
                  )}
                </div>

                {deleting && (
                  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
                    <div className="bg-gray-900 border border-red-700 rounded-lg p-8 max-w-xs text-center">
                      <div className="mb-4 text-lg text-red-200 font-bold">Delete this order?</div>
                      <div className="mb-6 text-gray-300">This can't be undone.</div>
                      <button
                        className="px-4 py-1 bg-red-700 text-white rounded hover:bg-red-600 mr-2"
                        disabled={deleteLoading}
                        onClick={async () => { setDeleteLoading(true); try {
                          const token = getToken();
                          const res = await fetch(
                            `http://localhost:3001/api/orders/${selectedOrder.order_id}`,
                            { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
                          );
                          if (res.ok) {
                            removeOrderFromState(selectedOrder.order_id);
                            toast.success('Order deleted successfully!');
                            setSelectedOrder(null);
                          } else {
                            const errData = await res.json().catch(() => ({}));
                            toast.error(errData.error || 'Failed to delete order');
                          }
                        } catch (err) {
                          toast.error('Network error: ' + err.message);
                        } finally { setDeleteLoading(false); setDeleting(false); }}}
                      >Yes, Delete</button>
                      <button className="px-4 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600" onClick={() => setDeleting(false)} disabled={deleteLoading}>Cancel</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setEditLoading(true); try {
                const token = getToken();
                const res = await fetch(`http://localhost:3001/api/orders/${selectedOrder.order_id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    pickup_location: editFields.pickup_location,
                    drop_off_location: editFields.drop_off_location,
                    weight: editFields.weight,
                    size: editFields.size,
                    scheduled_delivery_time: editFields.scheduled_delivery_time,
                    delivery_fee: editFields.delivery_fee,
                  })
                });
                if (res.ok) {
                  const updatedOrder = await res.json();
                  updateOrderInState(updatedOrder);
                  setEditMode(false);
                  setSelectedOrder(updatedOrder);
                  toast.success('Order updated successfully!');
                } else {
                  const err = await res.json();
                  toast.error(err.error || 'Failed to update order');
                }
              } catch (err) { toast.error('Failed to update order'); } finally { setEditLoading(false); }}}>
                <div className="grid grid-cols-1 gap-2 text-gray-200">
                  <div>
                    <label className="block text-gray-400 text-sm">Pickup Address</label>
                    <input
                      ref={editPickupInputRef}
                      type="text"
                      className="w-full px-2 py-1 rounded border"
                      value={editFields.pickup_location || ''}
                      onChange={e => setEditFields(f => ({ ...f, pickup_location: e.target.value }))}
                      required
                      placeholder="Start typing address..."
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm">Dropoff Address</label>
                    <input
                      ref={editDropoffInputRef}
                      type="text"
                      className="w-full px-2 py-1 rounded border"
                      value={editFields.drop_off_location || ''}
                      onChange={e => setEditFields(f => ({ ...f, drop_off_location: e.target.value }))}
                      required
                      placeholder="Start typing address..."
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm">Weight (kg)</label>
                    <input type="number" className="w-full px-2 py-1 rounded border" value={editFields.weight || ''} onChange={e=>setEditFields(f=>({...f,weight: e.target.value}))} min={0} step={0.01} required />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm">Size</label>
                    <select className="w-full px-2 py-1 rounded border" value={editFields.size || ''} onChange={e=>setEditFields(f=>({...f,size: e.target.value}))} >
                      <option value="">Select size</option>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm">Scheduled (YYYY-MM-DD HH:MM)</label>
                    <input type="datetime-local" className="w-full px-2 py-1 rounded border" value={editFields.scheduled_delivery_time ? editFields.scheduled_delivery_time.slice(0,16) : ''} onChange={e=>setEditFields(f=>({...f,scheduled_delivery_time:e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm">Delivery Fee (₱) <span className="text-red-400">*</span></label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1 rounded border"
                      value={editMode ? (editFields.delivery_fee || '') : (formData.deliveryFee || '')}
                      onChange={editMode
                        ? e => setEditFields(f => ({ ...f, delivery_fee: e.target.value }))
                        : e=> setFormData(f=>({ ...f, deliveryFee: e.target.value }))}
                      required
                      placeholder="Input agreed delivery fee"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm">Commission (₱)</label>
                    <div className="w-full px-2 py-1 rounded border bg-gray-800 text-white">10.00</div>
                  </div>
                </div>
                <div className="my-4">
                  <div className="mb-2 text-sm text-blue-400 font-semibold">Route Preview:</div>
                  <div
                    ref={orderDetailMapRef}
                    style={{ width: '100%', height: 260, borderRadius: 8, border: '1px solid #334155', background: '#232946' }}
                  />
                  {(!editFields.pickup_location || !editFields.drop_off_location) && (
                    <div className="mt-3 text-sm text-gray-400">Both pickup and dropoff addresses are required for route preview.</div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" className="px-4 py-1 bg-green-700 text-green-100 rounded hover:bg-green-600" disabled={editLoading}>{editLoading ? 'Saving...' : 'Save'}</button>
                  <button type="button" className="px-4 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600" onClick={()=>{setEditMode(false);setEditFields({});}} disabled={editLoading}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Orders List */}
      {!routeOptimizationOnly && (
        <div>
          {orders.length === 0 ? (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-4 text-gray-400">No orders yet. Create your first order to get started!</p>
              </div>
            ) : (
              renderGroupedOrders()
            )}
        </div>
      )}
    </div>
  );
};

export default BusinessOwnerOrders;

