import { z } from 'zod';
import { TimeInfoSchema } from '@models/time.models';

export const MISSION_CONSTANTS = {
  BASE_VERSION_NUMBER: 1,
  ACTIVE_ID: 'Active',
  STAKE_STRUCTURE_ID: 'Stakestructure',
  TRAINING_TYPE: 'אימונים',
  OPERATIONAL_TYPE: 'מבצעי',
} as const;

export const SonicMissionPropertiesSchema = z
  .object({
    id: z.number(),
    kind: z.string(),
    area: z.string(),
    essence: z.string(),
    createBy: z.string(),
    pm: z.string(),
    sonicUpdate: z.coerce.date(),
    globusUpdate: z.coerce.date(),
    platform: z.string(),
    squadron: z.string(),
    category: z.string(),
    attachedMission: z.number().int(),
  })
  .partial();

export type SonicMissionProperties = z.infer<typeof SonicMissionPropertiesSchema>;

export const MissionBaseSchema = z.object({
  id: z.string().uuid(),
  timeInfo: TimeInfoSchema.nullable(),
  name: z.string().min(1),
  comment: z.string().nullable(),
  createdBy: z.string().nullable(),
  missionType: z.string().nullable(),
  password: z.string().nullable(),
  attachedMissionId: z.number().int().nullable(),
});

export type MissionBase = z.infer<typeof MissionBaseSchema>;

export const MissionSchema = MissionBaseSchema.extend({
  versionNumber: z.number().int(),
  sonicProperties: SonicMissionPropertiesSchema.nullable(),
});

export type Mission = z.infer<typeof MissionSchema>;
