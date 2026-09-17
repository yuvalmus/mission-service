import { createEntityDeleterService } from 'services/entity-deleter.service';
import { ENTITY_TYPES } from 'constants/entity.constants';
import { BadRequestError } from 'errors/app.errors';
import {
  MISSION_ID,
  OTHER_MISSION_ID,
  createCommonActionsMock,
  createEntityRepositoryMock,
  createLoggerMock,
  createUnitOfWorkMock,
} from '../fixtures/mission.fixtures';
import {
  ROUTE_ID,
  WPT_ID,
  buildCircle,
  buildRoute,
  buildWpt,
  createEntityAdderMock,
  createEntityRetrieverMock,
} from '../fixtures/entity.fixtures';

describe('entity-deleter.service', () => {
  const entityRepository = createEntityRepositoryMock();
  const entityRetriever = createEntityRetrieverMock();
  const entityAdder = createEntityAdderMock();
  const commonActions = createCommonActionsMock();
  const unitOfWork = createUnitOfWorkMock();
  const logger = createLoggerMock();

  const service = createEntityDeleterService({
    entityRepository,
    entityRetriever,
    entityAdder,
    commonActions,
    unitOfWork,
    logger,
  });

  describe('deleteEntity', () => {
    it('deletes a plain entity and bumps the parent version', async () => {
      entityRetriever.findEntity.mockResolvedValue(buildCircle());
      entityRepository.deleteById.mockResolvedValue(true);

      const result = await service.deleteEntity(ENTITY_TYPES.CIRCLE, MISSION_ID, WPT_ID, false);

      expect(result).toBe(true);
      expect(commonActions.bumpParentVersion).toHaveBeenCalledWith(MISSION_ID, undefined);
    });

    it('throws when the entity does not exist', async () => {
      entityRetriever.findEntity.mockResolvedValue(null);

      await expect(
        service.deleteEntity(ENTITY_TYPES.CIRCLE, MISSION_ID, WPT_ID, false),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it('rejects deleting a stake-category entity through the non-stake path', async () => {
      entityRetriever.findEntity.mockResolvedValue(buildCircle({ category: 'TrainingLow' }));

      await expect(
        service.deleteEntity(ENTITY_TYPES.CIRCLE, MISSION_ID, WPT_ID, false),
      ).rejects.toThrow(/stake category/);
    });

    it('rejects deleting a user wpt that is connected to routes, listing the route names', async () => {
      const route = buildRoute({ name: 'RTE00' });
      entityRetriever.findEntityOfType.mockResolvedValue(buildWpt({ connectedRoutes: [route.id] }));
      entityRepository.findByType.mockResolvedValue([route]);

      await expect(
        service.deleteEntity(ENTITY_TYPES.NAVIGATION_WAY_POINT, MISSION_ID, WPT_ID, false),
      ).rejects.toThrow(/RTE00/);
    });

    it('duplicates a stake wpt per referencing mission before deleting it', async () => {
      const stakeWpt = buildWpt({ category: 'mri', connectedRoutes: [ROUTE_ID] });
      const referencingRoute = buildRoute({ parentId: OTHER_MISSION_ID, wptsIds: [stakeWpt.id] });
      entityRetriever.findEntityOfType.mockResolvedValue(stakeWpt);
      entityRepository.findByType.mockResolvedValue([referencingRoute]);
      entityRepository.update.mockImplementation(async (entity) => entity);
      entityRepository.deleteById.mockResolvedValue(true);
      entityAdder.addEntity.mockImplementation(async (entity) => entity);

      const result = await service.deleteEntity(
        ENTITY_TYPES.NAVIGATION_WAY_POINT,
        MISSION_ID,
        stakeWpt.id,
        true,
      );

      expect(result).toBe(true);
      const duplicated = entityAdder.addEntity.mock.calls[0]![0];
      expect(duplicated.parentId).toBe(OTHER_MISSION_ID);
      expect(duplicated.id).not.toBe(stakeWpt.id);
      const remappedRoute = entityRepository.update.mock.calls[0]![0];
      expect((remappedRoute as { wptsIds: string[] }).wptsIds).toContain(duplicated.id);
      expect(entityRepository.deleteById).toHaveBeenCalledWith(stakeWpt.id, {});
    });
  });

  describe('deleteRoute', () => {
    it('deletes line-point wpts, disconnects other wpts and removes the route', async () => {
      const linePoint = buildWpt({ category: 'linePoint' });
      const userWpt = buildWpt({ id: OTHER_MISSION_ID, category: 'user', connectedRoutes: [ROUTE_ID] });
      const route = buildRoute({ wptsIds: [linePoint.id, userWpt.id] });

      entityRetriever.findEntityOfType.mockImplementation(async (entityType, id) => {
        if (entityType === ENTITY_TYPES.ROUTE) return route as never;
        return (id === linePoint.id ? linePoint : userWpt) as never;
      });
      entityRepository.deleteById.mockResolvedValue(true);
      entityRepository.update.mockImplementation(async (entity) => entity);

      const result = await service.deleteRoute(MISSION_ID, ROUTE_ID, false);

      expect(result).toBe(true);
      expect(entityRepository.deleteById).toHaveBeenCalledWith(linePoint.id, {});
      expect(entityRepository.deleteById).toHaveBeenCalledWith(ROUTE_ID, {});
      const disconnected = entityRepository.update.mock.calls[0]![0];
      expect((disconnected as { connectedRoutes: string[] }).connectedRoutes).not.toContain(ROUTE_ID);
    });

    it('throws when the route does not exist', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(null);

      await expect(service.deleteRoute(MISSION_ID, ROUTE_ID, false)).rejects.toBeInstanceOf(BadRequestError);
    });
  });
});
