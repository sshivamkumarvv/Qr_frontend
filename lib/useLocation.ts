"use client";

import { useState, useEffect, useCallback } from "react";

export interface LocationState {
  coords: { latitude: number; longitude: number } | null;
  loading: boolean;
  error: string | null;
  permissionState: "prompt" | "granted" | "denied" | "unsupported";
}

export function useLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(() => {
    if (typeof window === "undefined") return null;
    const storedLat = sessionStorage.getItem("userLat");
    const storedLng = sessionStorage.getItem("userLng");
    if (storedLat && storedLng) {
      const lat = parseFloat(storedLat);
      const lng = parseFloat(storedLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<
    "prompt" | "granted" | "denied" | "unsupported"
  >("prompt");

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setPermissionState("unsupported");
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          setPermissionState(result.state);
          result.onchange = () => {
            setPermissionState(result.state);
          };
        })
        .catch(() => {
          // Fallback if permissions query fails
        });
    }
  }, []);

  const requestLocation = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser.");
      setPermissionState("unsupported");
      return null;
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setCoords(newCoords);
          sessionStorage.setItem("userLat", String(newCoords.latitude));
          sessionStorage.setItem("userLng", String(newCoords.longitude));
          setLoading(false);
          setPermissionState("granted");
          resolve(newCoords);
        },
        (err) => {
          setLoading(false);
          let message = "Unable to retrieve your location.";
          if (err.code === err.PERMISSION_DENIED) {
            message =
              "Location access was denied. Please allow location permissions in your browser address bar/settings.";
            setPermissionState("denied");
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message =
              "Location information is currently unavailable. Please check your GPS or network.";
          } else if (err.code === err.TIMEOUT) {
            message = "Location request timed out. Please try again.";
          }
          setError(message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return {
    coords,
    loading,
    error,
    permissionState,
    requestLocation,
  };
}
