import { z } from 'zod';
import {
  ENTITY_SOURCES,
  ENTITY_TYPES,
  EntityType,
  LINE_STYLES,
  NAME_MAX_LENGTHS,
  STAKE_CATEGORIES,
} from '@constants/entity.constants';
import { isKnownColor } from '@constants/color.constants';
import { TimeInfoSchema, ActiveTimeSchema } from '@models/time.models';

export const COLOR_VALIDATION_MESSAGE = (color: string) => `The color ${color} is not a valid Globus color`;

export const KnownColorSchema = z
  .string()
  .refine(isKnownColor, (value) => ({ message: COLOR_VALIDATION_MESSAGE(value) }));

export const EntitySourceSchema = z.enum(ENTITY_SOURCES);
export const LineStyleSchema = z.enum(LINE_STYLES);

export const createEntityBaseSchema = <T extends EntityType>(
  entityType: T,
  nameMaxLength: number = NAME_MAX_LENGTHS.DEFAULT,
) =>
  z.object({
    id: z.string().uuid(),
    parentId: z.string().uuid(),
    entityType: z.literal(entityType),
    name: z.string().min(1).max(nameMaxLength),
    remark: z.string().default(''),
    source: EntitySourceSchema,
    timeInfo: TimeInfoSchema,
    isVisible: z.boolean(),
  });

export const RemoteEntitySchema = z.object({
  remoteId: z.number().nonnegative().default(0),
  remoteName: z.string().default(''),
});

export const NullableActiveTimeSchema = ActiveTimeSchema.nullable().default(null);

const STAKE_CATEGORY_SET: ReadonlySet<string> = new Set(STAKE_CATEGORIES);

export const isStakeCategory = (category: string): boolean => STAKE_CATEGORY_SET.has(category);

export interface EntityCommon {
  id: string;
  parentId: string;
  entityType: EntityType;
  name: string;
  remark: string;
  source: string;
  category: string;
  timeInfo: { dateCreated: Date; lastUpdateTime: Date };
  isVisible: boolean;
}

export const isEntrecoteEntity = (entity: Pick<EntityCommon, 'category'>): boolean =>
  isStakeCategory(entity.category);
