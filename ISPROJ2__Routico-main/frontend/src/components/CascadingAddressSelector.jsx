import React, { useState, useEffect, useRef } from 'react';
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

    // Only update if we have at least city selected and street is valid
    if (city && (!street.trim() || streetRegex.test(street.trim()))) {
      onChange(fullAddress);
    } else if (city && street.trim() && !streetRegex.test(street.trim())) {
      // Invalid street characters — clear the address so form can't submit
      onChange('');
    } else {
      onChange('');
      onLocationResolved(null);
    }
  }, [region, province, city, barangay, street]);

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

  // When street changes, geocode full address biased toward barangay location
  useEffect(() => {
    if (!city) return;
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    geocodeTimeoutRef.current = setTimeout(() => {
      if (!window.google || !window.google.maps) return;

      // If no street, use barangay-level location
      if (!street.trim()) {
        if (barangayLocationRef.current) {
          onLocationResolved(barangayLocationRef.current);
        }
        return;
      }

      setIsGeocoding(true);
      const geocoder = new window.google.maps.Geocoder();

      // Build full address for geocoding
      const parts = [street.trim()];
      if (barangay.trim()) parts.push(barangay.trim());
      parts.push(city);
      if (province) parts.push(province);
      parts.push('Philippines');

      const request = {
        address: parts.join(', '),
        region: 'ph',
        componentRestrictions: { country: 'PH' }
      };

      // Bias results toward the barangay area so the geocoder doesn't jump elsewhere
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
          const resolved = { lat: loc.lat(), lng: loc.lng() };
          const formattedAddress = results[0].formatted_address.toLowerCase();
          const streetWords = street.trim().toLowerCase().split(/\s+/).filter(w => w.length > 2);

          // Check if the key words from the typed street appear in Google's result
          // This handles abbreviations like "Avenue" vs "Ave", "Street" vs "St"
          const mainWord = streetWords.length > 0 ? streetWords[0] : street.trim().toLowerCase();
          if (!formattedAddress.includes(mainWord)) {
            setStreetError('Street not found on Google Maps. Please enter a valid street name.');
            onLocationResolved(barangayLocationRef.current || resolved);
            return;
          }

          // Safety check: if result is too far from barangay (>5km), street is invalid
          if (barangayLocationRef.current) {
            const dist = Math.sqrt(
              Math.pow((resolved.lat - barangayLocationRef.current.lat) * 111, 2) +
              Math.pow((resolved.lng - barangayLocationRef.current.lng) * 111 * Math.cos(resolved.lat * Math.PI / 180), 2)
            );
            if (dist > 5) {
              setStreetError('Street not found in this area. Please check the street name.');
              onLocationResolved(barangayLocationRef.current);
              return;
            }
          }

          setStreetError('');
          onLocationResolved(resolved);
        } else if (barangayLocationRef.current) {
          // Geocode failed — street not recognized
          setIsGeocoding(false);
          setStreetError('Street not found on Google Maps. Please enter a valid street name.');
          onLocationResolved(barangayLocationRef.current);
        }
      });
    }, 500);
  }, [street, barangay, city, province, region]);

  const [streetError, setStreetError] = useState('');
  const streetRegex = /^[a-zA-Z0-9\s.,#\-\/]+$/;

  const handleStreetChange = (val) => {
    setStreet(val);
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
