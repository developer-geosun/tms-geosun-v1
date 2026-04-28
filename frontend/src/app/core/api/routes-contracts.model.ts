export type RoutePointType = 'start' | 'stop' | 'finish' | 'border';

export interface RoutePointContract {
  order: number;
  type: RoutePointType;
  address: string;
  lat: number;
  lng: number;
  country: string;
  isBorder: boolean;
  segmentDistanceKmToNext: number | null;
}

export interface HereRouteMetaContract {
  provider: string;
  routeHandle: string | null;
  apiVersion: string;
}

export interface SaveRouteContractRequest {
  title: string;
  routingProfile: string;
  routingMode: string;
  routePolyline: string;
  distanceKm: number | null;
  durationMin: number | null;
  routeComment: string | null;
  points: RoutePointContract[];
  hereRouteMeta: HereRouteMetaContract | null;
}

export interface RouteSummaryContractDto {
  id: string;
  title: string;
  distanceKm: number | null;
  durationMin: number | null;
  pointsCount: number;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface RouteSnapshotContractDto {
  id: string;
  title: string;
  routingProfile: string;
  routingMode: string;
  routePolyline: string;
  distanceKm: number | null;
  durationMin: number | null;
  routeComment: string | null;
  createdAt: string;
  updatedAt: string;
  points: RoutePointContract[];
}

