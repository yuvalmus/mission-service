import { Request } from 'express';
import { createEntityRetrieverController } from 'controllers/entity.retriever.controller';
import { getEntityDefinition } from 'mappers/entity.registry';
import { ENTITY_TYPES } from 'constants/entity.constants';
import { HTTP_STATUS } from 'constants/http.constants';
import { EntityIdParams } from 'dtos/commonEntity.dtos';
import { createHttpContext } from '../fixtures/express.fixtures';
import {
  CIRCLE_ID,
  ROUTE_ID,
  WPT_ID,
  buildCircle,
  buildRoute,
  buildWpt,
  createEntityRetrieverMock
} from '../fixtures/entity.fixtures';
import { createRouteServiceMock } from '../fixtures/mission.fixtures';

describe('entity-retriever.controller', () => {
  const entityRetriever = createEntityRetrieverMock();
  const routeService = createRouteServiceMock();
  const controller = createEntityRetrieverController(entityRetriever, routeService);
  const circleDefinition = getEntityDefinition(ENTITY_TYPES.CIRCLE);
  const wptDefinition = getEntityDefinition(ENTITY_TYPES.NAVIGATION_WAY_POINT);

  describe('getEntity (circle)', () => {
    it('returns 200 with the typed dto', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(buildCircle());
      const { req, res } = createHttpContext<Request<EntityIdParams>>({
        params: { id: CIRCLE_ID }
      });

      await controller.getEntity(circleDefinition)(req, res, jest.fn());

      expect(entityRetriever.findEntityOfType).toHaveBeenCalledWith(ENTITY_TYPES.CIRCLE, CIRCLE_ID);
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({ entityType: ENTITY_TYPES.CIRCLE });
    });

    it('returns 404 when the entity does not exist', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(null);
      const { req, res } = createHttpContext<Request<EntityIdParams>>({
        params: { id: CIRCLE_ID }
      });

      await controller.getEntity(circleDefinition)(req, res, jest.fn());

      expect(res.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('getEntity (wpt)', () => {
    it('returns 200 with the wpt dto', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(buildWpt());
      const { req, res } = createHttpContext<Request<EntityIdParams>>({
        params: { id: WPT_ID }
      });

      await controller.getEntity(wptDefinition)(req, res, jest.fn());

      expect(entityRetriever.findEntityOfType).toHaveBeenCalledWith(
        ENTITY_TYPES.NAVIGATION_WAY_POINT,
        WPT_ID
      );
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({
        entityType: ENTITY_TYPES.NAVIGATION_WAY_POINT,
        altitudeFeet: 100
      });
    });

    it('returns 404 when the wpt does not exist', async () => {
      entityRetriever.findEntityOfType.mockResolvedValue(null);
      const { req, res } = createHttpContext<Request<EntityIdParams>>({
        params: { id: WPT_ID }
      });

      await controller.getEntity(wptDefinition)(req, res, jest.fn());

      expect(res.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('getRoute', () => {
    it('returns the retrieve dto with wpt coordinates', async () => {
      routeService.getFullRoute.mockResolvedValue({ route: buildRoute(), routeWpts: [buildWpt()] });
      const { req, res } = createHttpContext<Request<EntityIdParams>>({ params: { id: ROUTE_ID } });

      await controller.getRoute(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData().wptsCoords).toHaveLength(1);
    });

    it('returns 404 for an unknown route', async () => {
      routeService.getFullRoute.mockResolvedValue(null);
      const { req, res } = createHttpContext<Request<EntityIdParams>>({ params: { id: ROUTE_ID } });

      await controller.getRoute(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('getNavigationRoute', () => {
    it('returns the navigation dto with leg data', async () => {
      routeService.getFullRoute.mockResolvedValue({ route: buildRoute(), routeWpts: [buildWpt()] });
      const { req, res } = createHttpContext<Request<EntityIdParams>>({ params: { id: ROUTE_ID } });

      await controller.getNavigationRoute(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData().legs).toHaveLength(1);
    });
  });
});
