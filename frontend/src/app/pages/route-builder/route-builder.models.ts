export type FreightLang = 'uk' | 'ru' | 'en';

export type CountryCode = 'ua' | 'pl' | 'sk' | 'hu' | 'ro' | 'md' | string;

export interface Checkpoint {
  name: Record<FreightLang, string>;
  lat: number;
  lng: number;
}

export interface Waypoint {
  lat: number;
  lng: number;
  address: string;
  country: CountryCode | null;
  isBorder: boolean;
}

export interface RoutePointPayload {
  order: number;
  type: 'start' | 'stop' | 'finish' | 'border';
  address: string;
  lat: number;
  lng: number;
  country: string;
  isBorder: boolean;
  segmentDistanceKmToNext: number | null;
}

export interface FreightRequestPayload {
  clientRequestId: string;
  timestamp: string;
  source: string;
  userAgent: string;
  lang: FreightLang;
  email: string;
  phone: string;
  preferredStartDate: string;
  routeComment: string;
  distanceKm: number;
  points: RoutePointPayload[];
  route: string;
}
