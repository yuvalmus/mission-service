import { createEntityUpdaterService } from '@services/entity-updater.service';
import { ENTITY_TYPES } from '@constants/entity.constants';
import { BadRequestError } from '@errors/app.errors';
import { toBasicEntityDto } from '@mappers/entity.mapper';
import {
  MISSION_ID,
  createCommonActionsMock,
  createEntityRepositoryMock,
  createLoggerMock,
} from '../fixtures/mission.fixtures';
import {
  CIRCLE_ID,
  buildCircle,
  buildRoute,
  buildWpt,
  createEntityRetrieverMock,
  createRouteWptServiceMock,
} from '../fixtures/entity.fixtures';

describe('entity-updater.service', () => {
  const entityRepository = createEntityRepositoryMock();
  const entityRetriever = createEntityRetrieverMock();
  const commonActions = createCommonActionsMock();
  const routeWptService = createRouteWptServiceMock();
  const logger = createLoggerMock();

  const service = createEntityUpdaterService({
    entityRepository,
    entityRetriever,
    commonActions,
    routeWptService,
    logger,
  });

  describe('updateByType', () => {
    it('applies the typed update, persists it and bumps the parent version', async () => {
      const circle = buildCircle();
      entityRetriever.findEntityOfType.mockResolvedValue(circle);
      entityRepository.isNameTaken.mockResolvedValue(false);
      entityRepository.update.mockImplementation(async (entity) => entity);

      const dto = {
        id: CIRCLE_ID,
        parentId: MISSION_ID,
        category: 'General',
        beginTime: null,
        endTime: null,
        minAltitudeFeet: 0,
        maxAltitudeFeet: 2000,
        name: 'C002',
        remark: 'updated',
        isVisible: false,
        lineStyle: 'ThinLine',
        color: 'Blue',
        isFilled: true,
        radiusNm: 9,
        position: { latitude: 31, longitude: 35, datum: 'WGS84' as const },
        remoteId: 7,
        remoteName: 'r',
      };
      const updated = await service.updateByType(ENTITY_TYPES.CIRCLE, dto);

      expect(updated).toMatchObject({ name: 'C002', isFilled: true, radiusNm: 9 });
      expect(entityRepository.update).toHaveBeenCalledTimes(1);
      expect(commonActions.bumpParentVersion).toHaveBeenCalledWith(MISSION_ID, undefined);
    });

    it('throws when the entity does not exist', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(null);

      await expect(
        service.updateByType(ENTITY_TYPES.CIRCLE, { id: CIRCLE_ID, parentId: MISSION_ID }),
      ).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('updateEntity', () => {
    it('rejects when the new name belongs to a different entity in the parent', async () => {
      const circle = buildCircle();
      entityRepository.isNameTaken.mockResolvedValue(true);

      await expect(service.updateEntity(MISSION_ID, circle)).rejects.toBeInstanceOf(BadRequestError);
      expect(entityRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('changeEntityVisibility', () => {
    it('toggles visibility, refreshes lastUpdateTime and returns the basic dto', async () => {
      const circle = buildCircle({ isVisible: true });
      entityRetriever.findEntity.mockResolvedValue(circle);
      entityRepository.isNameTaken.mockResolvedValue(false);
      entityRepository.update.mockImplementation(async (entity) => entity);

      const result = await service.changeEntityVisibility({
        entity: toBasicEntityDto(circle),
        isVisible: false,
      });

      expect(result.isVisible).toBe(false);
      const persisted = entityRepository.update.mock.calls[0]![0];
      expect(persisted.isVisible).toBe(false);
    });

    it('wraps failures in a 400 with the entity name in the message', async () => {
      const circle = buildCircle();
      entityRetriever.findEntity.mockResolvedValue(null);

      await expect(
        service.changeEntityVisibility({ entity: toBasicEntityDto(circle), isVisible: false }),
      ).rejects.toThrow(/Failed to change visibility for entity C001/);
    });

    it('cascades a route visibility change to its wpts first', async () => {
      const route = buildRoute();
      const wpt = buildWpt();
      entityRetriever.findEntityOfType.mockResolvedValue(route);
      entityRetriever.findEntity.mockImplementation(async (id) => (id === route.id ? route : wpt));
      routeWptService.getRouteWptsAsBasicDtos.mockResolvedValue([toBasicEntityDto(wpt)]);
      entityRepository.isNameTaken.mockResolvedValue(false);
      entityRepository.update.mockImplementation(async (entity) => entity);

      await service.changeEntityVisibility({ entity: toBasicEntityDto(route), isVisible: false });

      expect(routeWptService.getRouteWptsAsBasicDtos).toHaveBeenCalledWith(route);
      const updatedIds = entityRepository.update.mock.calls.map(([entity]) => entity!.id);
      expect(updatedIds).toContain(wpt.id);
      expect(updatedIds).toContain(route.id);
    });
  });

  describe('changeEntitiesVisibility', () => {
    it('changes visibility for every entity in the list', async () => {
      const circle = buildCircle();
      entityRetriever.findEntity.mockResolvedValue(circle);
      entityRepository.isNameTaken.mockResolvedValue(false);
      entityRepository.update.mockImplementation(async (entity) => entity);

      const result = await service.changeEntitiesVisibility({
        entities: [toBasicEntityDto(circle), toBasicEntityDto(circle)],
        isVisible: false,
      });

      expect(result).toHaveLength(2);
    });

    it('wraps list failures in a 400', async () => {
      entityRetriever.findEntity.mockResolvedValue(null);

      await expect(
        service.changeEntitiesVisibility({ entities: [toBasicEntityDto(buildCircle())], isVisible: true }),
      ).rejects.toThrow(/Failed to change visibility for the entity list/);
    });
  });
});
