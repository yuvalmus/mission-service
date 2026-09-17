import { ENTITY_TYPES } from '@constants/entity.constants';
import { FullRoute } from '@models/entity-union.models';
import { Route } from '@models/route.models';
import { Wpt } from '@models/points.models';
import { CreateOrUpdateRouteDto, RouteLegDto } from '@dtos/route.dtos';
import { CreateRouteWptDto } from '@dtos/points.dtos';
import { UnitOfWork } from '@database/database.types';
import { BadRequestError } from '@errors/app.errors';
import { ERROR_MESSAGES } from '@constants/error.constants';
import { ROUTE_LIMITS } from '@constants/entity.constants';
import { applyRouteUpdate, routeAsCreateOrUpdateDto, routeFromCreateOrUpdateDto } from '@mappers/route.mapper';
import { isEntrecoteEntity } from '@models/entity.models';
import { EntityRepository } from '@repositories/entity.repository';
import { EntityAdderService } from '@services/entity-adder.service';
import { EntityRetrieverService } from '@services/entity-retriever.service';
import { EntityUpdaterService } from '@services/entity-updater.service';
import { RouteWptService } from '@services/route-wpt.service';
import { AppLogger } from '@utils/logger.util';

export interface RouteService {
  getFullRoute(routeId: string): Promise<FullRoute | null>;
  addRoute(dto: CreateOrUpdateRouteDto, parentId: string): Promise<Route>;
  updateRoute(dto: CreateOrUpdateRouteDto): Promise<Route>;
  cloneRoute(route: Route): Promise<CreateOrUpdateRouteDto>;
}

export interface RouteServiceDeps {
  entityRepository: EntityRepository;
  entityRetriever: EntityRetrieverService;
  entityAdder: EntityAdderService;
  entityUpdater: EntityUpdaterService;
  routeWptService: RouteWptService;
  unitOfWork: UnitOfWork;
  logger: AppLogger;
}

const areLegsValid = (legs: readonly RouteLegDto[], wpts: readonly CreateRouteWptDto[]): boolean =>
  legs.every(
    (leg) => wpts.some((wpt) => wpt.id === leg.startWpt) && wpts.some((wpt) => wpt.id === leg.endWpt),
  );

export const createRouteService = ({
  entityRepository,
  entityRetriever,
  entityAdder,
  entityUpdater,
  routeWptService,
  unitOfWork,
  logger,
}: RouteServiceDeps): RouteService => ({
  getFullRoute: async (routeId) => {
    const route = await entityRetriever.findEntityOfType<Route>(ENTITY_TYPES.ROUTE, routeId);
    if (!route) return null;
    const routeWpts = await routeWptService.getRouteWpts(route);
    return { route, routeWpts };
  },

  addRoute: async (dto, parentId) => {
    logger.info({ parentId, routeId: dto.id }, 'Attempting to add a route');
    if (dto.wpts.length < ROUTE_LIMITS.MIN_WPTS) {
      throw new BadRequestError(ERROR_MESSAGES.ROUTE_MIN_WPTS);
    }

    const route = routeFromCreateOrUpdateDto(dto);
    return unitOfWork.run(async (context) => {
      const existingRoute = await entityRetriever.findEntityOfType<Route>(ENTITY_TYPES.ROUTE, route.id);
      if (existingRoute) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_ALREADY_EXISTS(dto.id));
      }
      await routeWptService.createWptsForRoute(dto.wpts, route, context);
      if (!areLegsValid(dto.legs, dto.wpts)) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_CREATE_INVALID_LEGS);
      }
      return entityAdder.addEntity(route, parentId, context);
    });
  },

  updateRoute: async (dto) => {
    logger.info({ routeId: dto.id, parentId: dto.parentId }, 'Attempting to update a route');
    if (dto.wpts.length < ROUTE_LIMITS.MIN_WPTS) {
      throw new BadRequestError(ERROR_MESSAGES.ROUTE_MIN_WPTS);
    }

    const route = await entityRetriever.findEntityOfType<Route>(ENTITY_TYPES.ROUTE, dto.id);
    if (!route) {
      throw new BadRequestError(
        ERROR_MESSAGES.ENTITY_UPDATE_NOT_FOUND(ENTITY_TYPES.ROUTE, dto.id, dto.parentId),
      );
    }

    return unitOfWork.run(async (context) => {
      const withoutWpts = await routeWptService.removeWpts(route, dto, context);
      await routeWptService.createWptsForRoute(dto.wpts, withoutWpts, context);
      if (!areLegsValid(dto.legs, dto.wpts)) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_UPDATE_INVALID_LEGS);
      }
      const updatedRoute = applyRouteUpdate(withoutWpts, dto);
      return entityUpdater.updateEntity(dto.parentId, updatedRoute, context);
    });
  },

  cloneRoute: async (route) => {
    logger.info({ parentId: route.parentId, routeId: route.id }, 'Attempting to clone a route');
    const wpts = (await entityRepository.findByType(ENTITY_TYPES.NAVIGATION_WAY_POINT)) as Wpt[];

    const newWpts: Wpt[] = [];
    const oldIdToNewWpt = new Map<string, Wpt>();

    for (const oldWptId of route.wptsIds) {
      const oldWpt = wpts.find((wpt) => wpt.id === oldWptId);
      if (!oldWpt) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_CLONE_WPT_ID_MISSING(oldWptId, route.parentId));
      }

      const newWpt = wpts.find(
        (wpt) =>
          wpt.name === oldWpt.name &&
          (isEntrecoteEntity(oldWpt) || wpt.parentId === route.parentId) &&
          wpt.id !== oldWptId,
      );
      if (!newWpt) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_CLONE_WPT_NAME_MISSING(oldWpt.name, route.parentId));
      }

      newWpts.push(newWpt);
      oldIdToNewWpt.set(oldWpt.id, newWpt);
    }

    const remapped = { ...route, legs: route.legs.map((leg) => ({ ...leg })) };
    for (const leg of remapped.legs) {
      if (remapped.zmmWptId === leg.endWpt) {
        remapped.zmmWptId = oldIdToNewWpt.get(leg.endWpt)?.id ?? remapped.zmmWptId;
      }
      leg.startWpt = oldIdToNewWpt.get(leg.startWpt)?.id ?? leg.startWpt;
      leg.endWpt = oldIdToNewWpt.get(leg.endWpt)?.id ?? leg.endWpt;
    }

    return routeAsCreateOrUpdateDto(remapped, newWpts);
  },
});
