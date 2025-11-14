import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Navigation, Phone, ArrowLeft, Loader2 } from "lucide-react";
import { calculateDistance, formatDistance, getUserLocation, type UserLocation } from "@/utils/geolocation";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

interface Venue {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  service_types: string[];
  distance?: number;
}

export default function FindVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadVenuesAndLocation();
  }, []);

  useEffect(() => {
    if (userLocation && venues.length > 0 && containerRef.current && !mapRef.current) {
      initializeMap();
    }
  }, [userLocation, venues]);

  const loadVenuesAndLocation = async () => {
    try {
      setLoading(true);

      // Get user location
      try {
        const location = await getUserLocation();
        setUserLocation(location);
      } catch (error: any) {
        console.error('Error getting location:', error);
        setLocationError(
          error.code === 1 
            ? 'Location access denied. Please enable location services.' 
            : 'Unable to get your location. Please try again.'
        );
      }

      // Fetch all venues with coordinates
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('name');

      if (error) throw error;

      setVenues(data || []);
    } catch (error: any) {
      console.error('Error loading venues:', error);
      toast({
        title: "Error",
        description: "Failed to load venues",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    if (!containerRef.current || !userLocation || mapRef.current) return;

    // Initialize map centered on user
    const map = L.map(containerRef.current).setView([userLocation.latitude, userLocation.longitude], 13);
    mapRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // User location icon (blue)
    const userIcon = L.divIcon({
      html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>',
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    // Add user marker
    L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
      .addTo(map)
      .bindPopup('<b>Your Location</b>');

    // Venue icon (red)
    const venueIcon = L.icon({
      iconUrl: icon,
      shadowUrl: iconShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    // Add venue markers
    const sortedVenues = getSortedVenues();
    sortedVenues.forEach((venue) => {
      if (venue.latitude && venue.longitude) {
        const marker = L.marker([venue.latitude, venue.longitude], { icon: venueIcon })
          .addTo(map)
          .bindPopup(`
            <div>
              <b>${venue.name}</b><br/>
              ${venue.address || ''}<br/>
              ${venue.distance ? `<small>${formatDistance(venue.distance)} away</small>` : ''}
            </div>
          `);
        
        marker.on('click', () => {
          // Scroll to venue card
          const venueElement = document.getElementById(`venue-${venue.id}`);
          if (venueElement) {
            venueElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    });
  };

  const getSortedVenues = () => {
    if (!userLocation) return venues;

    return venues
      .map((venue) => ({
        ...venue,
        distance: venue.latitude && venue.longitude
          ? calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              venue.latitude,
              venue.longitude
            )
          : undefined,
      }))
      .sort((a, b) => (a.distance || 999) - (b.distance || 999));
  };

  const handleJoinWaitlist = (venueId: string) => {
    navigate(`/waitlist/${venueId}`);
  };

  const sortedVenues = getSortedVenues();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Finding venues near you...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Find Venues Near Me</h1>
          </div>
          
          {userLocation ? (
            <p className="text-muted-foreground flex items-center gap-2">
              <Navigation className="h-4 w-4 text-green-600" />
              Showing {sortedVenues.length} venues near your location
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-destructive">{locationError}</p>
              <Button size="sm" variant="outline" onClick={loadVenuesAndLocation}>
                Try Again
              </Button>
            </div>
          )}
        </div>

        {userLocation && sortedVenues.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Map View</CardTitle>
              <CardDescription>Your location and nearby venues</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                ref={containerRef} 
                className="w-full h-[400px] rounded-lg overflow-hidden border border-border"
              />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedVenues.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="pt-6 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-semibold mb-2">No venues found</p>
                <p className="text-sm text-muted-foreground">
                  There are no venues with location data available yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedVenues.map((venue) => (
              <Card key={venue.id} id={`venue-${venue.id}`} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{venue.name}</CardTitle>
                      {venue.distance && (
                        <Badge variant="secondary" className="mt-2">
                          {formatDistance(venue.distance)} away
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {venue.address && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{venue.address}</span>
                    </div>
                  )}
                  
                  {venue.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{venue.phone}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {venue.service_types?.includes('food_ready') && (
                      <Badge variant="outline">Food Orders</Badge>
                    )}
                    {venue.service_types?.includes('table_ready') && (
                      <Badge variant="outline">Table Waitlist</Badge>
                    )}
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => handleJoinWaitlist(venue.id)}
                  >
                    Join Waitlist
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
