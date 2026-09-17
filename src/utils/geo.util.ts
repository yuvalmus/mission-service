export const FEET_IN_METER = 3.28083;
export const METERS_IN_NAUTICAL_MILE = 1852;

export const metersToFeet = (meters: number): number => meters * FEET_IN_METER;
export const feetToMeters = (feet: number): number => feet / FEET_IN_METER;
export const nmToMeters = (nm: number): number => nm * METERS_IN_NAUTICAL_MILE;
export const metersToNm = (meters: number): number => meters / METERS_IN_NAUTICAL_MILE;
