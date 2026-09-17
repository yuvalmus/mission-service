import { z } from 'zod';

export const DATUMS = {
  ED50: 'ED50',
  WGS84: 'WGS84',
} as const;

const GEO_LIMITS = {
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
} as const;

export const GeoCoordinateSchema = z.object({
  latitude: z.number().min(GEO_LIMITS.MIN_LATITUDE).max(GEO_LIMITS.MAX_LATITUDE),
  longitude: z.number().min(GEO_LIMITS.MIN_LONGITUDE).max(GEO_LIMITS.MAX_LONGITUDE),
  datum: z.enum([DATUMS.ED50, DATUMS.WGS84]).default(DATUMS.WGS84),
});

export type GeoCoordinate = z.infer<typeof GeoCoordinateSchema>;
