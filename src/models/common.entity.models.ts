import { z } from 'zod';
import {
  ENTITY_SOURCES,
  EntityType,
  LINE_STYLES,
  NAME_MAX_LENGTHS,
  STAKE_CATEGORIES,
  EntitySources
} from 'constants/entity.constants';
import { isValidEntityColor } from 'constants/color.constants';
import { TimeInfoSchema, ActiveTimeSchema } from 'models/time.models';

export const COLOR_VALIDATION_MESSAGE = (color: string) =>
  `The color ${color} is not a valid Universe color`;

export const EntityColorSchema = z.string().refine(isValidEntityColor);

export const EntitySourceSchema = z.enum(ENTITY_SOURCES);
export const LineStyleSchema = z.enum(LINE_STYLES);

export const createEntityBaseSchema = <T extends EntityType>(
  entityType: T,
  maxNameLength: number = NAME_MAX_LENGTHS.DEFAULT
) =>
  z.object({
    id: z.uuid(),
    parentId: z.uuid(),
    entityType: z.literal(entityType),
    name: z.string().min(1).max(maxNameLength),
    remark: z.string().default(''),
    source: EntitySourceSchema,
    timeInfo: TimeInfoSchema,
    isVisible: z.boolean()
  });

export const RemoteEntitySchema = z.object({
  remoteId: z.number().nonnegative().optional(),
  remoteName: z.string().optional()
});

export const OptionalActiveTimeSchema = ActiveTimeSchema.optional();

export interface BaseEntity {
  id: string;
  parentId: string;
  entityType: EntityType;
  name: string;
  remark: string;
  source: EntitySources;
  category: string;
  timeInfo: { dateCreated: Date; lastUpdateTime: Date };
  isVisible: boolean;
}

export const isStakeEntity = (category: string): boolean =>
  (Object.values(STAKE_CATEGORIES) as readonly string[]).includes(category);
