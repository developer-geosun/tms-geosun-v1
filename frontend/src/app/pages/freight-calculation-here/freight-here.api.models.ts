export interface HereGeocodeResponse {
  items: HereRawGeocodeItem[];
}

export interface HereReverseGeocodeResponse {
  items: HereRawGeocodeItem[];
}

export interface HereGeocodeItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    country_code?: string;
  };
}

export interface HereRawGeocodeItem {
  title: string;
  position: {
    lat: number;
    lng: number;
  };
  address?: {
    countryCode?: string;
  };
}

export interface HereRouteResponse {
  routes: HereRoute[];
}

export interface HereRoute {
  sections: Array<{
    polyline: string;
    summary: {
      length: number;
    };
  }>;
}
