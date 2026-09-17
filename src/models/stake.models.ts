import { z } from 'zod';
import { SQUADRONS } from '@constants/entity.constants';

export const STAKE_CONSTANTS = {
  BASE_VERSION_NUMBER: 1,
} as const;

export const SquadronSchema = z.enum(SQUADRONS);

export type Squadron = z.infer<typeof SquadronSchema>;

export const StakeSchema = z.object({
  id: z.string().uuid(),
  squadronName: SquadronSchema,
  versionNumber: z.number().int(),
});

export type Stake = z.infer<typeof StakeSchema>;

export const parseSquadron = (value: string): Squadron | null =>
  SQUADRONS.find((squadron) => squadron.toLowerCase() === value.toLowerCase()) ?? null;
