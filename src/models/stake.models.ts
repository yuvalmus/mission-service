import { z } from 'zod';
import { PATRICKS } from 'constants/entity.constants';

export const STAKE_CONSTANTS = {
  BASE_VERSION_NUMBER: 1
} as const;

export const PatrickSchema = z.enum(PATRICKS);

export type Patrick = z.infer<typeof PatrickSchema>;

export const StakeSchema = z.object({
  id: z.string().uuid(),
  patrickName: PatrickSchema,
  versionNumber: z.number().int()
});

export type Stake = z.infer<typeof StakeSchema>;

export const parsePatrick = (value: string): Patrick | null =>
  PATRICKS.find(patrick => patrick.toLowerCase() === value.toLowerCase()) ?? null;
