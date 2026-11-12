import { createEntityCreatorController } from 'controllers/entity.creator.controller';
import { getEntityDefinition } from 'mappers/entity.registry';
import { ENTITY_TYPES } from 'constants/entity.constants';
import { HTTP_STATUS } from 'constants/http.constants';
import { BadRequestError } from 'errors/app.errors';
import { ROUTES } from 'constants/app.constants';
import { createHttpContext } from '../fixtures/express.fixtures';
import {
  buildCreateCircleDto,
  buildCreateOrUpdateRouteDto,
  buildRoute,
  buildWpt,
  createEntityAdderMock
} from '../fixtures/entity.fixtures';
import { createRouteServiceMock, MISSION_ID } from '../fixtures/mission.fixtures';

describe('entity-creator.controller', () => {
  const entityAdder = createEntityAdderMock();
  const routeService = createRouteServiceMock();
  const controller = createEntityCreatorController(entityAdder, routeService);
  const circleDefinition = getEntityDefinition(ENTITY_TYPES.CIRCLE);
  const wptDefinition = getEntityDefinition(ENTITY_TYPES.NAVIGATION_WAY_POINT);

  describe('createEntity (circle)', () => {
    it('creates the entity and returns its dto with 201', async () => {
      entityAdder.addEntity.mockImplementation(async entity => entity);
      const { req, res } = createHttpContext({
        baseUrl: ROUTES.CREATE,
        body: buildCreateCircleDto()
      });

      await controller.createEntity(circleDefinition)(req, res, jest.fn());

      expect(entityAdder.addEntity).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: ENTITY_TYPES.CIRCLE, parentId: MISSION_ID }),
        MISSION_ID
      );
      expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
      expect(res._getJSONData()).toMatchObject({ entityType: ENTITY_TYPES.CIRCLE, radiusNm: 5 });
    });

    it('rejects a stake category on the non-stake path', async () => {
      const { req, res } = createHttpContext({
        baseUrl: ROUTES.CREATE,
        body: buildCreateCircleDto({ category: 'trainingLow' })
      });

      await expect(
        controller.createEntity(circleDefinition)(req, res, jest.fn())
      ).rejects.toBeInstanceOf(BadRequestError);
      expect(entityAdder.addEntity).not.toHaveBeenCalled();
    });

    it('accepts a stake category on the stake path', async () => {
      entityAdder.addEntity.mockImplementation(async entity => entity);
      const { req, res } = createHttpContext({
        baseUrl: ROUTES.CREATE_STAKE,
        body: buildCreateCircleDto({ category: 'trainingLow', maxAltitudeFeet: 4000 })
      });

      await controller.createEntity(circleDefinition)(req, res, jest.fn());

      expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
    });
  });

  describe('createEntity (wpt)', () => {
    it('creates the wpt and returns its dto with 201', async () => {
      entityAdder.addEntity.mockResolvedValue(buildWpt());
      const { req, res } = createHttpContext({
        baseUrl: ROUTES.CREATE,
        body: {
          parentId: MISSION_ID,
          source: 'universe',
          category: 'user',
          altitudeFeet: 100,
          name: 'NV001',
          remark: '',
          isVisible: true,
          position: { latitude: 32, longitude: 34, datum: 'WGS84' }
        }
      });

      await controller.createEntity(wptDefinition)(req, res, jest.fn());

      expect(entityAdder.addEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: ENTITY_TYPES.NAVIGATION_WAY_POINT,
          parentId: MISSION_ID
        }),
        MISSION_ID
      );
      expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
    });
  });

  describe('createRoute', () => {
    it('delegates to the route service and returns the route dto', async () => {
      routeService.addRoute.mockResolvedValue(buildRoute());
      const { req, res } = createHttpContext({
        baseUrl: ROUTES.CREATE,
        body: buildCreateOrUpdateRouteDto()
      });

      await controller.createRoute(req, res);

      expect(routeService.addRoute).toHaveBeenCalledWith(req.body, MISSION_ID);
      expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
      expect(res._getJSONData()).toMatchObject({ entityType: ENTITY_TYPES.ROUTE });
    });
  });
});
