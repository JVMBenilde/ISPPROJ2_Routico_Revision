import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import useGeolocation from './useGeolocation';

const useLocationReporter = (enabled = false, intervalMs = 30000) => {
  const { getToken } = useAuth();
  const { latitude, longitude, accuracy, error, isTracking } = useGeolocation(enabled);
  const lastSentRef = useRef({ lat: null, lng: null });

  useEffect(() => {
    if (!enabled || !isTracking || !latitude || !longitude) return;

    const reportLocation = async () => {
      try {
        const token = getToken();
        if (!token) return;

        await fetch('/api/tracking/location', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ latitude, longitude })
        });

        lastSentRef.current = { lat: latitude, lng: longitude };
      } catch (err) {
        console.error('Error reporting location:', err);
      }
    };

    // Report immediately on first position
    reportLocation();

    // Then report every intervalMs
    const interval = setInterval(reportLocation, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, isTracking, latitude, longitude, getToken, intervalMs]);

  return { latitude, longitude, accuracy, error, isTracking };
};

export default useLocationReporter;
