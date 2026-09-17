import { z } from 'zod';

export const TimeInfoSchema = z.object({
  dateCreated: z.coerce.date(),
  lastUpdateTime: z.coerce.date()
});

export type TimeInfo = z.infer<typeof TimeInfoSchema>;

export const ActiveTimeSchema = z
  .object({
    beginTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional()
  })
  .refine(({ beginTime, endTime }) => !beginTime || !endTime || beginTime < endTime, {
    message: 'beginTime must be before endTime'
  });

export type ActiveTime = z.infer<typeof ActiveTimeSchema>;

export const createTimeInfo = (now: Date = new Date()): TimeInfo => ({
  dateCreated: now,
  lastUpdateTime: now
});
