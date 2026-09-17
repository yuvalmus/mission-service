import { createRouteService } from '@services/route.service';
import { ENTITY_TYPES } from '@constants/entity.constants';
import { ERROR_MESSAGES } from '@constants/error.constants';
import {
  MISSION_ID,
  OTHER_MISSION_ID,
  createEntityRepositoryMock,
  createLoggerMock,
  createUnitOfWorkMock,
} from '../fixtures/mission.fixtures';
import {
  ROUTE_ID,
  SECOND_WPT_ID,
  WPT_ID,
  buildCreateOrUpdateRouteDto,
  buildRoute,
  buildRouteLeg,
  buildWpt,
  createEntityAdderMock,
  createEntityRetrieverMock,
  createEntityUpdaterMock,
  createRouteWptServiceMock,
} from '../fixtures/entity.fixtures';

describe('route.service', () => {
  const entityRepository = createEntityRepositoryMock();
  const entityRetriever = createEntityRetrieverMock();
  const entityAdder = createEntityAdderMock();
  const entityUpdater = createEntityUpdaterMock();
  const routeWptService = createRouteWptServiceMock();
  const unitOfWork = createUnitOfWorkMock();
  const logger = createLoggerMock();

  const service = createRouteService({
    entityRepository,
    entityRetriever,
    entityAdder,
    entityUpdater,
    routeWptService,
    unitOfWork,
    logger,
  });

  describe('getFullRoute', () => {
    it('returns the route with its ordered wpts', async () => {
      const route = buildRoute();
      const wpts = [buildWpt()];
      entityRetriever.findEntityOfType.mockResolvedValue(route);
      routeWptService.getRouteWpts.mockResolvedValue(wpts);

      await expect(service.getFullRoute(ROUTE_ID)).resolves.toEqual({ route, routeWpts: wpts });
    });

    it('returns null for an unknown route', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(null);

      await expect(service.getFullRoute(ROUTE_ID)).resolves.toBeNull();
    });
  });

  describe('addRoute', () => {
    it('rejects a route with fewer than two wpts', async () => {
      const dto = buildCreateOrUpdateRouteDto({ wpts: [] });

      await expect(service.addRoute(dto, MISSION_ID)).rejects.toThrow(ERROR_MESSAGES.ROUTE_MIN_WPTS);
    });

    it('rejects when a route with the same id already exists', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(buildRoute());
      const dto = buildCreateOrUpdateRouteDto();

      await expect(service.addRoute(dto, MISSION_ID)).rejects.toThrow(
        ERROR_MESSAGES.ROUTE_ALREADY_EXISTS(dto.id),
      );
    });

    it('rejects legs that reference unknown wpts', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(null);
      routeWptService.createWptsForRoute.mockImplementation(async (_wpts, route) => route);
      const dto = buildCreateOrUpdateRouteDto({
        legs: [
          {
            startWpt: WPT_ID,
            endWpt: '99999999-9999-4999-8999-999999999999',
            distanceNm: 1,
            angle: 0,
            legTimeMs: 1,
            isManualLegTime: false,
            tas: 100,
            zmmTime: null,
            highestPoint: null,
            safetyAltitude: 0,
            legOffsets: null,
            turnPoint: null,
          },
        ],
      });

      await expect(service.addRoute(dto, MISSION_ID)).rejects.toThrow(
        ERROR_MESSAGES.ROUTE_CREATE_INVALID_LEGS,
      );
    });

    it('creates the wpts and adds the route inside a unit of work', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(null);
      routeWptService.createWptsForRoute.mockImplementation(async (_wpts, route) => route);
      entityAdder.addEntity.mockImplementation(async (entity) => entity);
      const dto = buildCreateOrUpdateRouteDto();

      const route = await service.addRoute(dto, MISSION_ID);

      expect(route.id).toBe(ROUTE_ID);
      expect(route.wptsIds).toEqual([WPT_ID, SECOND_WPT_ID]);
      expect(routeWptService.createWptsForRoute).toHaveBeenCalledWith(dto.wpts, expect.anything(), {});
      expect(entityAdder.addEntity).toHaveBeenCalledWith(expect.objectContaining({ id: ROUTE_ID }), MISSION_ID, {});
    });
  });

  describe('updateRoute', () => {
    it('rejects updating a route that does not exist', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(null);

      await expect(service.updateRoute(buildCreateOrUpdateRouteDto())).rejects.toThrow(
        /does not exist in the mission/,
      );
    });

    it('removes dropped wpts, recreates the wpts and persists the updated route', async () => {
      const route = buildRoute();
      entityRetriever.findEntityOfType.mockResolvedValue(route);
      routeWptService.removeWpts.mockResolvedValue({ ...route, wptsIds: [] });
      routeWptService.createWptsForRoute.mockImplementation(async (_wpts, current) => current);
      entityUpdater.updateEntity.mockImplementation(async (_parentId, entity) => entity);
      const dto = buildCreateOrUpdateRouteDto({ name: 'RTE002' });

      const updated = await service.updateRoute(dto);

      expect(routeWptService.removeWpts).toHaveBeenCalledWith(route, dto, {});
      expect(updated.name).toBe('RTE002');
      expect(updated.wptsIds).toEqual([WPT_ID, SECOND_WPT_ID]);
    });
  });

  describe('cloneRoute', () => {
    it('remaps legs and zmm wpt to same-named wpts of the target mission', async () => {
      const oldWpt = buildWpt({ id: WPT_ID, name: 'NV001' });
      const oldEnd = buildWpt({ id: SECOND_WPT_ID, name: 'NV002' });
      const newWpt = buildWpt({ id: '77777777-7777-4777-8777-777777777777', name: 'NV001' });
      const newEnd = buildWpt({ id: '88888888-8888-4888-8888-888888888888', name: 'NV002' });
      entityRepository.findByType.mockResolvedValue([oldWpt, oldEnd, newWpt, newEnd]);
      const route = buildRoute({ legs: [buildRouteLeg()], zmmWptId: SECOND_WPT_ID });

      const dto = await service.cloneRoute(route);

      expect(dto.wpts.map((wpt) => wpt.id)).toEqual([newWpt.id, newEnd.id]);
      expect(dto.legs[0]).toMatchObject({ startWpt: newWpt.id, endWpt: newEnd.id });
      expect(dto.zmmWptId).toBe(newEnd.id);
    });

    it('fails when no same-named wpt exists in the target mission', async () => {
      const oldWpt = buildWpt({ id: WPT_ID, name: 'NV001' });
      const oldEnd = buildWpt({ id: SECOND_WPT_ID, name: 'NV002' });
      entityRepository.findByType.mockResolvedValue([oldWpt, oldEnd]);
      const route = buildRoute({ parentId: OTHER_MISSION_ID });

      await expect(service.cloneRoute(route)).rejects.toThrow(/does not exist in mission/);
    });
  });
});
