import { useState, useEffect, useRef, useCallback } from 'react';

const useGeolocation = (enabled = false) => {
  const [position, setPosition] = useState({ latitude: null, longitude: null, accuracy: null });
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef(null);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    };

    const onSuccess = (pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      });
      setError(null);
    };

    const onError = (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          setError('Location permission denied');
          break;
        case err.POSITION_UNAVAILABLE:
          setError('Location unavailable');
          break;
        case err.TIMEOUT:
          setError('Location request timed out');
          break;
        default:
          setError('Unknown location error');
      }
    };

    // Try watchPosition first, fall back to polling
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
    } catch (e) {
      // Fallback: poll every 30 seconds
      const poll = () => navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
      poll();
      watchIdRef.current = setInterval(poll, 30000);
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      if (typeof watchIdRef.current === 'number' && watchIdRef.current > 1000) {
        // It's a setInterval ID
        clearInterval(watchIdRef.current);
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [enabled, startTracking, stopTracking]);

  return { ...position, error, isTracking, startTracking, stopTracking };
};

export default useGeolocation;
