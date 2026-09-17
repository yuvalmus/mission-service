import { BasicMissionDtoSchema } from '@dtos/mission.dtos';
import {
  ActiveTimeDtoSchema,
  BasicEntityDtoSchema,
  GeneralEntityInfoSchema,
  UpdateBasicEntityDtoSchema,
} from '@dtos/entity.dtos';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const general = { id: ID, name: 'alpha', remark: '' };

describe('C# nullable parity: a missing key and an explicit null are the same thing', () => {
  describe('GeneralEntityInfo.timeInfo (C# TimeInfo?)', () => {
    it.each([
      ['key absent', general],
      ['explicit undefined', { ...general, timeInfo: undefined }],
      ['explicit null', { ...general, timeInfo: null }],
    ])('accepts %s and normalises to null', (_label, input) => {
      const result = GeneralEntityInfoSchema.safeParse(input);

      expect(result.success).toBe(true);
      expect(result.success && result.data.timeInfo).toBeNull();
    });

    it('still parses a supplied timeInfo', () => {
      const timeInfo = { dateCreated: '2026-01-01T00:00:00.000Z', lastUpdateTime: '2026-01-02T00:00:00.000Z' };

      const result = GeneralEntityInfoSchema.parse({ ...general, timeInfo });

      expect(result.timeInfo).toEqual(timeInfo);
    });
  });

  describe('BasicEntityDto.isVisible (C# bool?)', () => {
    it('accepts a body omitting both timeInfo and isVisible', () => {
      const result = BasicEntityDtoSchema.parse({ general, entityType: 'Circle', source: 'front' });

      expect(result.isVisible).toBeNull();
      expect(result.general.timeInfo).toBeNull();
    });
  });

  it('accepts the changeEntityVisibility body the front-end actually sends', () => {
    const result = UpdateBasicEntityDtoSchema.safeParse({
      entity: { general, entityType: 'Circle', source: 'front' },
      isVisible: true,
    });

    expect(result.success).toBe(true);
  });

  it('keeps isVisible required on the update wrapper itself', () => {
    const result = UpdateBasicEntityDtoSchema.safeParse({
      entity: { general, entityType: 'Circle', source: 'front' },
    });

    expect(result.success).toBe(false);
  });

  it('defaults ActiveTime bounds to null (C# DateTime?)', () => {
    expect(ActiveTimeDtoSchema.parse({})).toEqual({ beginTime: null, endTime: null });
  });

  it('defaults the nullable mission fields to null while keeping name required', () => {
    const result = BasicMissionDtoSchema.parse({ id: ID, timeInfo: null, name: 'mission' });

    expect(result).toMatchObject({
      comment: null,
      createdBy: null,
      missionType: null,
      password: null,
      attachedMissionId: null,
    });
    expect(BasicMissionDtoSchema.safeParse({ id: ID, timeInfo: null }).success).toBe(false);
  });
});
