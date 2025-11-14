import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

// Fix for default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

interface InteractiveLocationMapProps {
  initialLatitude: number;
  initialLongitude: number;
  address: string;
  onLocationChange: (lat: number, lng: number) => void;
}

export const InteractiveLocationMap = ({ 
  initialLatitude, 
  initialLongitude, 
  address,
  onLocationChange 
}: InteractiveLocationMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [manualLat, setManualLat] = useState(initialLatitude.toString());
  const [manualLng, setManualLng] = useState(initialLongitude.toString());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize the map
    const map = L.map(containerRef.current).setView([initialLatitude, initialLongitude], 16);
    mapRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Fix default marker icon
    const defaultIcon = L.icon({
      iconUrl: icon,
      shadowUrl: iconShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    // Add draggable marker
    const marker = L.marker([initialLatitude, initialLongitude], { 
      icon: defaultIcon,
      draggable: true 
    })
      .addTo(map)
      .bindPopup(`${address}<br/><small>Drag marker to adjust location</small>`)
      .openPopup();

    markerRef.current = marker;

    // Handle marker drag
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setManualLat(position.lat.toFixed(6));
      setManualLng(position.lng.toFixed(6));
      onLocationChange(position.lat, position.lng);
    });

    // Handle map clicks
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setManualLat(e.latlng.lat.toFixed(6));
      setManualLng(e.latlng.lng.toFixed(6));
      onLocationChange(e.latlng.lat, e.latlng.lng);
    });

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initialLatitude, initialLongitude, address]);

  const handleManualUpdate = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      if (markerRef.current && mapRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        mapRef.current.setView([lat, lng], 16);
        onLocationChange(lat, lng);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div 
        ref={containerRef} 
        className="w-full h-[400px] rounded-lg overflow-hidden border border-border"
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="manual-lat">Latitude</Label>
          <Input
            id="manual-lat"
            type="number"
            step="0.000001"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            placeholder="Latitude"
          />
        </div>
        <div>
          <Label htmlFor="manual-lng">Longitude</Label>
          <Input
            id="manual-lng"
            type="number"
            step="0.000001"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            placeholder="Longitude"
          />
        </div>
      </div>
      <Button onClick={handleManualUpdate} variant="outline" className="w-full">
        Update Location from Coordinates
      </Button>
      <p className="text-xs text-muted-foreground">
        💡 Click on the map or drag the marker to adjust the exact location. You can also manually enter coordinates above.
      </p>
    </div>
  );
};
