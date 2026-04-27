import * as L from 'leaflet';

/** Декодує HERE flexible polyline у координати Leaflet */
export function decodeHereFlexiblePolyline(encoded: string): L.LatLngExpression[] {
  const encodingTable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const decodingTable = new Map<string, number>([...encodingTable].map((char, index) => [char, index]));

  let index = 0;

  const decodeUnsignedVarint = (): number => {
    let result = 0;
    let shift = 0;
    while (index < encoded.length) {
      const char = encoded[index++];
      const value = decodingTable.get(char);
      if (value === undefined) {
        throw new Error('Invalid flexible polyline encoding');
      }
      result |= (value & 0x1f) << shift;
      if ((value & 0x20) === 0) {
        return result;
      }
      shift += 5;
    }
    throw new Error('Unexpected end of flexible polyline');
  };

  const decodeSignedVarint = (): number => {
    const value = decodeUnsignedVarint();
    const negative = value & 1;
    const shifted = value >> 1;
    return negative ? ~shifted : shifted;
  };

  const version = decodeUnsignedVarint();
  if (version !== 1) {
    throw new Error('Unsupported flexible polyline version');
  }
  const header = decodeUnsignedVarint();
  const precision = header & 15;
  const thirdDim = (header >> 4) & 7;
  const thirdDimPrecision = (header >> 7) & 15;
  const thirdDimPresent = thirdDim !== 0;
  const factorDegree = 10 ** precision;
  const factorZ = 10 ** thirdDimPrecision;

  let lat = 0;
  let lng = 0;
  let z = 0;
  const points: L.LatLngExpression[] = [];

  while (index < encoded.length) {
    lat += decodeSignedVarint();
    lng += decodeSignedVarint();
    if (thirdDimPresent) {
      z += decodeSignedVarint();
      void factorZ;
      void z;
    }
    points.push([lat / factorDegree, lng / factorDegree]);
  }

  return points;
}
