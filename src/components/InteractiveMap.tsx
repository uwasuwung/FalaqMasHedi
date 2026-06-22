import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Compass, MapPin, Loader2 } from "lucide-react";

interface InteractiveMapProps {
  latitude: number;
  longitude: number;
  onCoordinateChange: (lat: number, lon: number) => void;
}

export default function InteractiveMap({
  latitude,
  longitude,
  onCoordinateChange
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.LayerGroup | null>(null);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"leaflet" | "google">("leaflet");
  
  // Search state
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  
  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);

  // Initialize Map (only once)
  useEffect(() => {
    if (mapType !== "leaflet" || !mapContainerRef.current) return;

    try {
      // Create Leaflet Map instance
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 7,
        zoomControl: false // Disable default zoom controls to add styled ones later
      });

      // Standard OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>'
      }).addTo(map);

      // Add custom zoom control styled with High Density principles
      L.control.zoom({
        position: 'topright'
      }).addTo(map);

      // Attach map click handler
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const clampedLat = parseFloat(lat.toFixed(4));
        const clampedLon = parseFloat(lng.toFixed(4));
        onCoordinateChange(clampedLat, clampedLon);
      });

      mapInstanceRef.current = map;

      // Create a layer group to hold our target markers
      const markerGroup = L.layerGroup().addTo(map);
      markerInstanceRef.current = markerGroup;

      // Force instant resize in case container was hidden/resized
      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      return () => {
        map.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      };
    } catch (err: any) {
      console.error("Error initializing Leaflet map:", err);
      setErrorMessage("Gagal memuat modul peta visual. Pastikan koneksi internet aktif.");
    }
  }, [mapType]);

  // Update marker position when inputs change
  useEffect(() => {
    if (mapType !== "leaflet") return;
    const map = mapInstanceRef.current;
    const markerGroup = markerInstanceRef.current;

    if (!map || !markerGroup) return;

    // Clear existing markers in group
    markerGroup.clearLayers();

    // Create astronomical target style vector markers
    const centerPoint = L.circleMarker([latitude, longitude], {
      radius: 5,
      color: "#141414",
      fillColor: "#141414",
      fillOpacity: 1,
      weight: 1
    });

    const outerRing = L.circleMarker([latitude, longitude], {
      radius: 12,
      color: "#141414",
      fillColor: "transparent",
      weight: 1.5,
      dashArray: "3, 3"
    });

    const rangeRing = L.circleMarker([latitude, longitude], {
      radius: 24,
      color: "#141414",
      fillColor: "transparent",
      weight: 0.5,
      opacity: 0.3
    });

    // Add to group
    centerPoint.addTo(markerGroup);
    outerRing.addTo(markerGroup);
    rangeRing.addTo(markerGroup);

    // Pan map to coordinate
    map.panTo([latitude, longitude]);

  }, [latitude, longitude, mapType]);

  // Handle Nominatim search lookup
  const handleSearchLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    setIsSearching(true);
    setSearchFeedback(null);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&limit=1`
      );
      const data = await resp.json();
      if (data && data.length > 0) {
        const item = data[0];
        const newLat = parseFloat(item.lat);
        const newLon = parseFloat(item.lon);
        onCoordinateChange(parseFloat(newLat.toFixed(4)), parseFloat(newLon.toFixed(4)));
        setSearchFeedback(`Ditemukan: ${item.display_name.split(",")[0]}`);
      } else {
        setSearchFeedback("Kesalahan: Lokasi tidak dapat ditemukan.");
      }
    } catch (err) {
      console.error(err);
      setSearchFeedback("Kesalahan: Gagal menghubungi server geospasial.");
    } finally {
      setIsSearching(false);
    }
  };

  // GPS auto detector
  const handleGPSDetect = () => {
    if (!navigator.geolocation) {
      alert("Sensor GPS tidak didukung oleh browser Anda.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(4));
        const lon = parseFloat(pos.coords.longitude.toFixed(4));
        onCoordinateChange(lat, lon);
        setGpsLoading(false);
        setSearchFeedback("Lokasi GPS berhasil diperbarui.");
      },
      (err) => {
        console.error(err);
        setGpsLoading(false);
        alert("Gagal mengunci GPS. Mohon izinkan izin akses lokasi.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="border border-[#141414] bg-white text-[#141414] flex flex-col font-mono">
      {/* Header with Tab Selection */}
      <div className="px-3 py-1.5 border-b border-[#141414] bg-[#D8D7D4] text-[9px] uppercase font-bold tracking-widest flex justify-between items-center select-none">
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>Sistem Navigasi Markaz &amp; Koordinat</span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMapType("leaflet")}
            className={`px-2 py-0.5 text-[8px] uppercase font-bold border cursor-pointer transition-all ${
              mapType === "leaflet"
                ? "bg-[#141414] text-white border-[#141414]"
                : "bg-white text-[#141414] border-black/20 hover:border-[#141414]"
            }`}
          >
            Leaflet Map
          </button>
          <button
            type="button"
            onClick={() => setMapType("google")}
            className={`px-2 py-0.5 text-[8px] uppercase font-bold border cursor-pointer transition-all ${
              mapType === "google"
                ? "bg-[#141414] text-white border-[#141414]"
                : "bg-white text-[#141414] border-black/20 hover:border-[#141414]"
            }`}
          >
            Google Maps
          </button>
        </div>
      </div>

      {/* Map visualizer stage */}
      <div className="h-64 relative bg-[#E4E3E0] border-b border-[#141414]" style={{ minHeight: "240px" }}>
        {mapType === "leaflet" ? (
          <>
            {errorMessage && (
              <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#EBEAE7] text-center text-xs font-serif italic text-red-800 z-[1000]">
                <div>{errorMessage}</div>
              </div>
            )}
            <div ref={mapContainerRef} className="w-full h-full z-10 select-none map-grayscale" />
          </>
        ) : (
          <iframe
            title="Google Maps Coordinate Embed"
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ border: 0 }}
            src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=13&output=embed`}
            allowFullScreen
          />
        )}
      </div>

      {/* Manual input controls & interactive panel */}
      <div className="p-3 bg-[#EDEDEB] space-y-3">
        {/* Step 1: Geocoding Search */}
        <form onSubmit={handleSearchLoc} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Cari markaz/tempat (Cth: Masjid Istiqlal)..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-white border border-[#141414] pl-7 pr-2 py-1 text-[11px] font-mono focus:outline-none text-[#141414]"
            />
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#141414]/50" />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-1 bg-[#141414] text-[#E4E3E0] hover:bg-[#323230] font-bold text-[10px] uppercase cursor-pointer transition-colors flex items-center gap-1 border border-[#141414] disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cari"}
          </button>
        </form>

        {searchFeedback && (
          <div className="text-[9px] font-mono font-bold uppercase text-[#141414]/80 bg-white/60 p-1 px-2 border border-[#141414]/10 rounded flex justify-between items-center">
            <span>{searchFeedback}</span>
            <button type="button" onClick={() => setSearchFeedback(null)} className="text-[8px] font-bold opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Step 2: Manual Latitude/Longitude inputs and GPS button */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {/* Latitude manual input */}
          <div className="flex flex-1 items-center bg-white border border-[#141414] px-2 py-0.5">
            <span className="text-[9px] uppercase font-bold text-[#141414]/50 mr-2 select-none w-8">Lat</span>
            <input
              type="number"
              step="0.0001"
              min="-90"
              max="90"
              value={latitude}
              onChange={(e) => {
                const val = parseFloat(parseFloat(e.target.value).toFixed(4));
                if (!isNaN(val)) {
                  onCoordinateChange(Math.max(-90, Math.min(90, val)), longitude);
                }
              }}
              className="w-full bg-transparent border-0 py-0.5 text-xs font-mono focus:outline-none text-[#141414]"
            />
          </div>

          {/* Longitude manual input */}
          <div className="flex flex-1 items-center bg-white border border-[#141414] px-2 py-0.5">
            <span className="text-[9px] uppercase font-bold text-[#141414]/50 mr-2 select-none w-8">Lon</span>
            <input
              type="number"
              step="0.0001"
              min="-180"
              max="180"
              value={longitude}
              onChange={(e) => {
                const val = parseFloat(parseFloat(e.target.value).toFixed(4));
                if (!isNaN(val)) {
                  onCoordinateChange(latitude, Math.max(-180, Math.min(180, val)));
                }
              }}
              className="w-full bg-transparent border-0 py-0.5 text-xs font-mono focus:outline-none text-[#141414]"
            />
          </div>

          {/* GPS Detector button */}
          <button
            type="button"
            onClick={handleGPSDetect}
            disabled={gpsLoading}
            className="py-1.5 px-3 bg-[#E4E3E0] text-[#141414] hover:bg-[#D1D0CC] font-bold text-[10px] uppercase cursor-pointer transition-colors flex items-center justify-center gap-1.5 border border-[#141414] disabled:opacity-50"
            title="Deteksi posisi riil menggunakan satelit GPS"
          >
            {gpsLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Compass className="h-3.5 w-3.5" />
            )}
            <span>GPS</span>
          </button>
        </div>
      </div>
    </div>
  );
}
