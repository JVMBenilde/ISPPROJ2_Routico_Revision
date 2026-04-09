import { useState, useEffect, useRef } from 'react';
import philippineLocations from '../data/philippineLocations';
import philippineBarangays from '../data/philippineBarangays';
import { getStreetsForCity } from '../data/philippineStreets';

const CascadingAddressSelector = ({ label, value, onChange, onLocationResolved, required = false }) => {
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [barangay, setBarangay] = useState('');
  const [street, setStreet] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [streetError, setStreetError] = useState('');
  const [streetGeocodeFailed, setStreetGeocodeFailed] = useState(false);
  const geocodeTimeoutRef = useRef(null);
  const barangayLocationRef = useRef(null); // Store barangay-level coords for biasing

  // Derived options
  const regionKeys = Object.keys(philippineLocations);
  const provinceOptions = region ? Object.keys(philippineLocations[region]?.provinces || {}) : [];
  const cityOptions = region && province ? (philippineLocations[region]?.provinces[province] || []) : [];
  const barangayOptions = city ? (philippineBarangays[city] || []) : [];
  const streetOptions = (city && barangay) ? getStreetsForCity(city, barangay) : [];

  // Reset dependent fields on parent change
  useEffect(() => {
    setProvince('');
    setCity('');
    setBarangay('');
    setStreet('');
  }, [region]);

  useEffect(() => {
    setCity('');
    setBarangay('');
    setStreet('');
  }, [province]);

  useEffect(() => {
    setBarangay('');
    setStreet('');
  }, [city]);

  useEffect(() => {
    setStreet('');
    setStreetGeocodeFailed(false);
  }, [barangay]);

  // Build full address and notify parent whenever selections change
  useEffect(() => {
    const parts = [];
    if (street.trim()) parts.push(street.trim());
    if (barangay.trim()) parts.push(`Brgy. ${barangay.trim()}`);
    if (city) parts.push(city);
    if (province) parts.push(province);
    if (region) {
      const regionData = philippineLocations[region];
      parts.push(regionData ? regionData.name : region);
    }
    parts.push('Philippines');

    const fullAddress = parts.filter(Boolean).join(', ');

    // Only update if we have at least city selected, street chars are valid, and geocoding succeeded
    if (city && (!street.trim() || streetRegex.test(street.trim())) && !streetGeocodeFailed) {
      onChange(fullAddress);
    } else if (city && street.trim() && !streetRegex.test(street.trim())) {
      // Invalid street characters — clear the address so form can't submit
      onChange('');
    } else if (streetGeocodeFailed) {
      // Street typed but geocoding returned no results — block submission
      onChange('');
    } else {
      onChange('');
      onLocationResolved(null);
    }
  }, [region, province, city, barangay, street, streetGeocodeFailed]);

  // When barangay changes, geocode barangay-level location as reference point
  useEffect(() => {
    if (!city) {
      barangayLocationRef.current = null;
      return;
    }
    if (!window.google || !window.google.maps) return;

    const geocodeParts = [];
    if (barangay.trim()) geocodeParts.push(`Brgy. ${barangay.trim()}`);
    geocodeParts.push(city);
    if (province) geocodeParts.push(province);
    geocodeParts.push('Philippines');

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: geocodeParts.join(', '), region: 'ph' }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        barangayLocationRef.current = { lat: loc.lat(), lng: loc.lng() };
        // If no street selected yet, use barangay location
        if (!street.trim()) {
          onLocationResolved({ lat: loc.lat(), lng: loc.lng() });
        }
      }
    });
  }, [region, province, city, barangay]);

  // When street changes, validate then geocode for coordinates
  useEffect(() => {
    if (!city) return;
    if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);

    geocodeTimeoutRef.current = setTimeout(() => {
      if (!window.google || !window.google.maps) return;

      // No street typed — fall back to barangay-level location
      if (!street.trim()) {
        if (barangayLocationRef.current) onLocationResolved(barangayLocationRef.current);
        return;
      }

      const typed = street.trim().toLowerCase();

      // Step 1: Check local philippineStreets data as a fast-path ALLOW list.
      // A match means we skip the geocoding quality check (we already know it's real).
      // No match does NOT mean invalid — the street may exist but not be in our data,
      // so we still fall through to geocoding for the final verdict.
      let localConfirmed = false;
      if (streetOptions.length > 0) {
        localConfirmed = streetOptions.some(s => {
          const sLower = s.toLowerCase();
          return sLower.startsWith(typed) || sLower.includes(typed) || (typed.includes(sLower) && sLower.length > 3);
        });
        if (localConfirmed) {
          setStreetError('');
          setStreetGeocodeFailed(false);
        }
      }

      // Step 2: Geocode for coordinates.
      // Also validates quality when not locally confirmed — gibberish returns APPROXIMATE
      // which we reject; a real street returns ROOFTOP or RANGE_INTERPOLATED.
      setIsGeocoding(true);
      const geocoder = new window.google.maps.Geocoder();
      const parts = [street.trim(), city];
      if (province) parts.push(province);
      parts.push('Philippines');

      const request = {
        address: parts.join(', '),
        region: 'ph',
        componentRestrictions: { country: 'PH' }
      };

      if (barangayLocationRef.current) {
        const ref = barangayLocationRef.current;
        request.bounds = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(ref.lat - 0.02, ref.lng - 0.02),
          new window.google.maps.LatLng(ref.lat + 0.02, ref.lng + 0.02)
        );
      }

      geocoder.geocode(request, (results, status) => {
        setIsGeocoding(false);

        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location;

          if (localConfirmed) {
            // Local data confirmed — use coordinates directly, no quality check needed
            onLocationResolved({ lat: loc.lat(), lng: loc.lng() });
          } else {
            // Not in local data — validate via geocoding result quality.
            // Google often returns APPROXIMATE city/barangay fallbacks for gibberish;
            // ROOFTOP and RANGE_INTERPOLATED mean a real street was actually found.
            const locationType = results[0].geometry.location_type;
            const resultTypes = results[0].types || [];
            const isStreetLevel =
              locationType === 'ROOFTOP' ||
              locationType === 'RANGE_INTERPOLATED' ||
              resultTypes.includes('street_address') ||
              resultTypes.includes('route');

            if (isStreetLevel) {
              setStreetError('');
              setStreetGeocodeFailed(false);
              onLocationResolved({ lat: loc.lat(), lng: loc.lng() });
            } else {
              setStreetGeocodeFailed(true);
              setStreetError('Street not found. Please enter a valid street name.');
              onLocationResolved(null);
            }
          }
        } else {
          // Geocoding API returned nothing
          if (localConfirmed) {
            // Local data confirmed validity — fall back to barangay-level coordinates
            if (barangayLocationRef.current) onLocationResolved(barangayLocationRef.current);
          } else {
            setStreetGeocodeFailed(true);
            setStreetError('Street not found. Please enter a valid street name.');
            onLocationResolved(null);
          }
        }
      });
    }, 500);
  }, [street, barangay, city, province, region, streetOptions]);

  const streetRegex = /^[a-zA-Z0-9\s.,#\-\/]+$/;

  const handleStreetChange = (val) => {
    setStreet(val);
    setStreetGeocodeFailed(false); // reset on every keystroke so user can re-attempt
    if (val.trim() && !streetRegex.test(val.trim())) {
      setStreetError('Street name contains invalid characters. Use only letters, numbers, spaces, and common punctuation.');
    } else {
      setStreetError('');
    }
  };

  const selectClass = "w-full px-3 py-2 border border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-700 text-white appearance-none cursor-pointer";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <h5 className="text-sm font-semibold text-white">{label}</h5>
        {required && <span className="text-red-400 text-xs">*</span>}
        {isGeocoding && (
          <span className="text-xs text-blue-400 animate-pulse">Locating...</span>
        )}
        {value && !isGeocoding && (
          <span className="text-green-400 text-xs">&#10003; Located</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Region */}
        <div>
          <label className={labelClass}>Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className={selectClass}
          >
            <option value="">Select Region</option>
            {regionKeys.map(key => (
              <option key={key} value={key}>
                {philippineLocations[key].name}
              </option>
            ))}
          </select>
        </div>

        {/* Province */}
        <div>
          <label className={labelClass}>Province</label>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            disabled={!region}
            className={`${selectClass} ${!region ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">{region ? 'Select Province' : 'Select region first'}</option>
            {provinceOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* City/Municipality */}
        <div>
          <label className={labelClass}>City / Municipality</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={!province}
            className={`${selectClass} ${!province ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">{province ? 'Select City' : 'Select province first'}</option>
            {cityOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Barangay */}
        <div>
          <label className={labelClass}>Barangay</label>
          {city && barangayOptions.length > 0 ? (
            <select
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className={selectClass}
            >
              <option value="">Select Barangay</option>
              {barangayOptions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              disabled={!city}
              placeholder={city ? 'Type barangay name' : 'Select city first'}
              className={`${selectClass} ${!city ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          )}
        </div>

        {/* Street */}
        <div>
          <label className={labelClass}>Street</label>
          {barangay && streetOptions.length > 0 && (
            <select
              value={streetOptions.includes(street) ? street : ''}
              onChange={(e) => handleStreetChange(e.target.value)}
              className={`${selectClass} mb-1.5`}
            >
              <option value="">Pick a street or type below</option>
              {streetOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={street}
            onChange={(e) => handleStreetChange(e.target.value)}
            disabled={!barangay}
            placeholder={barangay ? 'Type street name if not listed' : 'Select barangay first'}
            className={`${selectClass} ${!barangay ? 'opacity-50 cursor-not-allowed' : ''} ${streetError ? 'border-red-500' : ''}`}
          />
          {streetError && <p className="text-xs text-red-400 mt-1">{streetError}</p>}
        </div>
      </div>

      {/* Full address preview */}
      {value && (
        <div className="flex items-start gap-2 bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/50">
          <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-xs text-gray-300 break-words">{value}</p>
        </div>
      )}
    </div>
  );
};

export default CascadingAddressSelector;
