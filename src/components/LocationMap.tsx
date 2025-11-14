import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  address: string;
}

export const LocationMap = ({ latitude, longitude, address }: LocationMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize the map
    const map = L.map(containerRef.current).setView([latitude, longitude], 15);
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

    // Add marker with popup
    L.marker([latitude, longitude], { icon: defaultIcon })
      .addTo(map)
      .bindPopup(address)
      .openPopup();

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, address]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[300px] rounded-lg overflow-hidden border border-border"
    />
  );
};
