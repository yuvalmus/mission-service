import { missionEntitiesFromDto, missionFromDto, toMissionDto } from 'mappers/mission.mapper';
import { buildMission } from '../fixtures/mission.fixtures';
import { buildCircle } from '../fixtures/entity.fixtures';

describe('mission.mapper', () => {
  const mission = buildMission();
  const circle = buildCircle();
  const dto = toMissionDto(mission, [circle]);

  describe('missionFromDto', () => {
    it('maps the dto to a mission without its entities', () => {
      const mapped = missionFromDto(dto);

      expect(mapped).toMatchObject({
        id: mission.id,
        name: mission.name,
        versionNumber: mission.versionNumber
      });
      expect(mapped).not.toHaveProperty('entities');
    });
  });

  describe('missionEntitiesFromDto', () => {
    it('maps the entities of the dto and parents them to the mission', () => {
      const entities = missionEntitiesFromDto(dto);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toMatchObject({ id: circle.id, parentId: mission.id });
    });
  });
});
