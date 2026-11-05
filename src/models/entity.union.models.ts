import { z } from 'zod';
import {
  CircleSchema,
  CorridorSchema,
  PolygonSchema,
  PolylineSchema,
  SectorSchema
} from 'models/entities.models';
import {
  EliahuSchema,
  LamineSchema,
  LandingZoneSchema,
  MessiSchema,
  IslandSchema,
  SymbolPointSchema,
  Wpt,
  WptSchema
} from 'models/entities.models';
import { Route, RouteSchema } from 'models/route.models';

export const EntitySchema = z.discriminatedUnion('entityType', [
  CircleSchema,
  SectorSchema,
  PolygonSchema,
  CorridorSchema,
  PolylineSchema,
  WptSchema,
  SymbolPointSchema,
  LandingZoneSchema,
  EliahuSchema,
  LamineSchema,
  MessiSchema,
  IslandSchema,
  RouteSchema
]);

export type Entity = z.infer<typeof EntitySchema>;
