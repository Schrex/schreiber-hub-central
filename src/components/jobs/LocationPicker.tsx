import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Fix default marker icons (vite asset URL workaround)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export interface PickedLocation {
  lat: number;
  lon: number;
  address: string;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
}

interface Props {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
  defaultCenter?: { lat: number; lon: number };
}

const DEFAULT_CENTER = { lat: 43.2245, lon: -77.2978 }; // Ontario, NY

const Recenter = ({ lat, lon }: { lat: number; lon: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [lat, lon, map]);
  return null;
};

const ClickHandler = ({ onClick }: { onClick: (lat: number, lon: number) => void }) => {
  const map = useMap();
  useEffect(() => {
    const h = (e: L.LeafletMouseEvent) => onClick(e.latlng.lat, e.latlng.lng);
    map.on("click", h);
    return () => { map.off("click", h); };
  }, [map, onClick]);
  return null;
};

export const LocationPicker = forwardRef<HTMLDivElement, Props>(({ value, onChange, defaultCenter = DEFAULT_CENTER }, ref) => {
  const [query, setQuery] = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressLabel, setAddressLabel] = useState(value?.address ?? "");
  const [layer, setLayer] = useState<"street" | "satellite">("street");
  const debounceRef = useRef<number | null>(null);
  const lastReverseRef = useRef(0);

  const center = useMemo(
    () => (value ? { lat: value.lat, lon: value.lon } : defaultCenter),
    [value, defaultCenter],
  );

  // Autocomplete (Nominatim)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (query === addressLabel) return; // don't re-search picked value
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&countrycodes=us&q=${encodeURIComponent(query)}`;
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        const arr: Suggestion[] = await r.json();
        setSuggestions(arr ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, addressLabel]);

  const reverseGeocode = async (lat: number, lon: number) => {
    // Throttle to once per second per Nominatim policy
    const now = Date.now();
    if (now - lastReverseRef.current < 800) return;
    lastReverseRef.current = now;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const j = await r.json();
      const label = j?.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setAddressLabel(label);
      setQuery(label);
      onChange({ lat, lon, address: label });
    } catch {
      const label = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setAddressLabel(label);
      setQuery(label);
      onChange({ lat, lon, address: label });
    }
  };

  const pick = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setAddressLabel(s.display_name);
    setQuery(s.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({ lat, lon, address: s.display_name });
  };

  const handleMapClick = (lat: number, lon: number) => {
    onChange({ lat, lon, address: addressLabel || `${lat.toFixed(5)}, ${lon.toFixed(5)}` });
    void reverseGeocode(lat, lon);
  };

  const handleDrag = (e: L.LeafletEvent) => {
    const m = e.target as L.Marker;
    const { lat, lng } = m.getLatLng();
    onChange({ lat, lon: lng, address: addressLabel || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    void reverseGeocode(lat, lng);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onChange({ lat: latitude, lon: longitude, address: addressLabel });
        void reverseGeocode(latitude, longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div ref={ref} className="space-y-2">
      <div className="relative">
        <Label htmlFor="loc-search" className="text-xs">Search address, place, or business</Label>
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="loc-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length && setShowSuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="e.g. Wegmans Pittsford, 123 Main St, Smith Farm"
            className="pl-8 pr-8"
            autoComplete="off"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-[1001] mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
            {suggestions.map((s, i) => (
              <button
                key={`${s.lat}-${s.lon}-${i}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className="flex w-full items-start gap-2 border-b border-border/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="flex-1 truncate">{s.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Tap the map or drag the pin to fine-tune.</span>
        <button type="button" onClick={useMyLocation} className="font-medium text-primary hover:underline">
          Use my location
        </button>
      </div>

      <div className={cn("h-64 w-full overflow-hidden rounded-lg border border-border")}>
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={value ? 15 : 11}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
          keyboard={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {value && (
            <>
              <Recenter lat={value.lat} lon={value.lon} />
              <Marker
                position={[value.lat, value.lon]}
                draggable
                eventHandlers={{ dragend: handleDrag }}
              />
            </>
          )}
          <ClickHandler onClick={handleMapClick} />
        </MapContainer>
      </div>

      {value && (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
          <p className="font-medium text-foreground">Selected:</p>
          <p className="truncate text-muted-foreground">{addressLabel || `${value.lat.toFixed(5)}, ${value.lon.toFixed(5)}`}</p>
        </div>
      )}
    </div>
  );
});
LocationPicker.displayName = "LocationPicker";
