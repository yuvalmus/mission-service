import { createEntityCreatorController } from '@controllers/entity-creator.controller';
import { getEntityDefinition } from '@mappers/entity.registry';
import { ENTITY_TYPES } from '@constants/entity.constants';
import { HTTP_STATUS } from '@constants/http.constants';
import { BadRequestError } from '@errors/app.errors';
import { ROUTES } from '@constants/app.constants';
import { createHttpContext } from '../fixtures/express.fixtures';
import {
  buildCreateCircleDto,
  buildCreateOrUpdateRouteDto,
  buildRoute,
  createEntityAdderMock,
} from '../fixtures/entity.fixtures';
import { createRouteServiceMock, MISSION_ID } from '../fixtures/mission.fixtures';

describe('entity-creator.controller', () => {
  const entityAdder = createEntityAdderMock();
  const routeService = createRouteServiceMock();
  const controller = createEntityCreatorController(entityAdder, routeService);
  const circleDefinition = getEntityDefinition(ENTITY_TYPES.CIRCLE);

  describe('createFor (circle)', () => {
    it('creates the entity and returns its dto with 200', async () => {
      entityAdder.addEntity.mockImplementation(async (entity) => entity);
      const { req, res } = createHttpContext({ baseUrl: ROUTES.CREATE, body: buildCreateCircleDto() });

      await controller.createFor(circleDefinition)(req, res, jest.fn());

      expect(entityAdder.addEntity).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: ENTITY_TYPES.CIRCLE, parentId: MISSION_ID }),
        MISSION_ID,
      );
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({ entityType: ENTITY_TYPES.CIRCLE, radiusNm: 5 });
    });

    it('rejects a stake category on the non-stake path', async () => {
      const { req, res } = createHttpContext({
        baseUrl: ROUTES.CREATE,
        body: buildCreateCircleDto({ category: 'TrainingLow' }),
      });

      await expect(controller.createFor(circleDefinition)(req, res, jest.fn())).rejects.toBeInstanceOf(
        BadRequestError,
      );
      expect(entityAdder.addEntity).not.toHaveBeenCalled();
    });

    it('accepts a stake category on the stake path', async () => {
      entityAdder.addEntity.mockImplementation(async (entity) => entity);
      const { req, res } = createHttpContext({
        baseUrl: ROUTES.CREATE_STAKE,
        body: buildCreateCircleDto({ category: 'TrainingLow', maxAltitudeFeet: 4000 }),
      });

      await controller.createFor(circleDefinition)(req, res, jest.fn());

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
    });
  });

  describe('createRoute', () => {
    it('delegates to the route service and returns the route dto', async () => {
      routeService.addRoute.mockResolvedValue(buildRoute());
      const { req, res } = createHttpContext({ baseUrl: ROUTES.CREATE, body: buildCreateOrUpdateRouteDto() });

      await controller.createRoute(req, res);

      expect(routeService.addRoute).toHaveBeenCalledWith(req.body, MISSION_ID);
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({ entityType: ENTITY_TYPES.ROUTE });
    });
  });
});
