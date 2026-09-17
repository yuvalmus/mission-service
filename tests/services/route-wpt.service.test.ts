import { createRouteWptService } from 'services/route-wpt.service';
import { BadRequestError } from 'errors/app.errors';
import {
  createCommonActionsMock,
  createEntityRepositoryMock,
} from '../fixtures/mission.fixtures';
import {
  SECOND_WPT_ID,
  WPT_ID,
  buildCreateOrUpdateRouteDto,
  buildCreateRouteWptDto,
  buildRoute,
  buildWpt,
  createEntityAdderMock,
} from '../fixtures/entity.fixtures';

describe('route-wpt.service', () => {
  const entityRepository = createEntityRepositoryMock();
  const entityAdder = createEntityAdderMock();
  const commonActions = createCommonActionsMock();
  const context = {};

  const service = createRouteWptService({ entityRepository, entityAdder, commonActions });

  describe('getRouteWpts', () => {
    it('returns the route wpts ordered by the route wptsIds', async () => {
      const first = buildWpt({ id: WPT_ID });
      const second = buildWpt({ id: SECOND_WPT_ID, name: 'NV002' });
      entityRepository.findByType.mockResolvedValue([second, first]);
      const route = buildRoute({ wptsIds: [WPT_ID, SECOND_WPT_ID] });

      const result = await service.getRouteWpts(route);

      expect(result.map((wpt) => wpt.id)).toEqual([WPT_ID, SECOND_WPT_ID]);
    });
  });

  describe('createWptsForRoute', () => {
    it('rejects duplicated wpt names or ids', async () => {
      const route = buildRoute();
      const duplicated = [buildCreateRouteWptDto(), buildCreateRouteWptDto()];

      await expect(service.createWptsForRoute(duplicated, route, context)).rejects.toThrow(
        /same name or same id/,
      );
    });

    it('creates missing wpts connected to the route', async () => {
      const route = buildRoute();
      entityRepository.findByType.mockResolvedValue([]);
      entityAdder.addEntity.mockImplementation(async (entity) => entity);

      await service.createWptsForRoute([buildCreateRouteWptDto()], route, context);

      const created = entityAdder.addEntity.mock.calls[0]![0];
      expect(created.id).toBe(WPT_ID);
      expect((created as { connectedRoutes: string[] }).connectedRoutes).toContain(route.id);
    });

    it('updates an existing line point that belongs to this route', async () => {
      const route = buildRoute();
      const existing = buildWpt({ category: 'linePoint', connectedRoutes: [route.id] });
      entityRepository.findByType.mockResolvedValue([existing]);
      entityRepository.update.mockImplementation(async (entity) => entity);

      await service.createWptsForRoute([buildCreateRouteWptDto({ name: 'NV009' })], route, context);

      const updated = entityRepository.update.mock.calls[0]![0];
      expect(updated.name).toBe('NV009');
    });

    it('rejects a line point that belongs to a different route', async () => {
      const route = buildRoute();
      const existing = buildWpt({ category: 'linePoint', connectedRoutes: ['5e5f6071-5555-4666-8777-88889999aaab'] });
      entityRepository.findByType.mockResolvedValue([existing]);

      await expect(
        service.createWptsForRoute([buildCreateRouteWptDto()], route, context),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it('rejects updating a permanent wpt whose data differs from the dto', async () => {
      const route = buildRoute();
      const existing = buildWpt({ category: 'user', name: 'OTHER' });
      entityRepository.findByType.mockResolvedValue([existing]);

      await expect(
        service.createWptsForRoute([buildCreateRouteWptDto({ category: 'user' })], route, context),
      ).rejects.toThrow(/cannot be updated/);
    });

    it('connects an unchanged permanent wpt to the route', async () => {
      const route = buildRoute();
      const dto = buildCreateRouteWptDto({ category: 'user' });
      const existing = buildWpt({ category: 'user', name: dto.name });
      entityRepository.findByType.mockResolvedValue([existing]);
      entityRepository.update.mockImplementation(async (entity) => entity);

      await service.createWptsForRoute([dto], route, context);

      const updated = entityRepository.update.mock.calls[0]![0];
      expect((updated as { connectedRoutes: string[] }).connectedRoutes).toContain(route.id);
    });
  });

  describe('removeWpts', () => {
    it('deletes dropped line points and disconnects dropped permanent wpts', async () => {
      const linePoint = buildWpt({ category: 'linePoint' });
      const userWpt = buildWpt({ id: SECOND_WPT_ID, name: 'NV002', category: 'user', connectedRoutes: [] });
      const route = buildRoute({ wptsIds: [linePoint.id, userWpt.id] });
      const dto = buildCreateOrUpdateRouteDto({ wpts: [] });
      entityRepository.findByType.mockResolvedValue([linePoint, userWpt]);
      entityRepository.deleteById.mockResolvedValue(true);
      entityRepository.update.mockImplementation(async (entity) => entity);

      const result = await service.removeWpts(route, dto, context);

      expect(entityRepository.deleteById).toHaveBeenCalledWith(linePoint.id, context);
      expect(entityRepository.update).toHaveBeenCalledTimes(1);
      expect(result.wptsIds).toEqual([]);
    });

    it('keeps wpts that are still part of the updated route', async () => {
      const linePoint = buildWpt({ category: 'linePoint' });
      const route = buildRoute({ wptsIds: [linePoint.id] });
      const dto = buildCreateOrUpdateRouteDto();
      entityRepository.findByType.mockResolvedValue([linePoint]);

      await service.removeWpts(route, dto, context);

      expect(entityRepository.deleteById).not.toHaveBeenCalled();
    });
  });
});
