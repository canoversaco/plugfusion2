import React, { useEffect, useRef } from "react";
import L from "leaflet";

// Vite/ESM: Marker-Icons korrekt setzen
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
const DefaultIcon = L.icon({ iconRetinaUrl, iconUrl, shadowUrl, iconSize: [25,41], iconAnchor: [12,41] });
L.Marker.prototype.options.icon = DefaultIcon;

export default function TreffpunktSelector({ value, onChange }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // Map nur einmal initialisieren
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(
      [value?.lat ?? 48.137, value?.lng ?? 11.575], // München fallback
      13
    );
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19
    }).addTo(map);

    // vorhandenen Punkt setzen
    if (value?.lat && value?.lng) {
      markerRef.current = L.marker([value.lat, value.lng]).addTo(map);
    }

    // Click-Handler: Punkt setzen/verschieben
    map.on("click", (e) => {
      const p = { lat: e.latlng.lat, lng: e.latlng.lng, desc: value?.desc || "" };
      if (!markerRef.current) {
        markerRef.current = L.marker([p.lat, p.lng]).addTo(map);
      } else {
        markerRef.current.setLatLng([p.lat, p.lng]);
      }
      onChange && onChange(p);
    });

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn value sich extern ändert, Marker nachziehen
  useEffect(() => {
    if (mapRef.current && value?.lat && value?.lng) {
      if (!markerRef.current) {
        markerRef.current = L.marker([value.lat, value.lng]).addTo(mapRef.current);
      } else {
        markerRef.current.setLatLng([value.lat, value.lng]);
      }
      mapRef.current.setView([value.lat, value.lng]);
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} style={{height:"260px", width:"100%", borderRadius:12, overflow:"hidden"}} />
      <input
        type="text"
        placeholder="Beschreibung (z. B. Eingang, Bank, Ladenname)…"
        defaultValue={value?.desc || ""}
        onChange={(e)=> onChange && onChange({ ...(value||{}), desc: e.target.value })}
        className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm"
      />
    </div>
  );
}
