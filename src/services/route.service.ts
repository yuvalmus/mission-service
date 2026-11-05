import { ENTITY_TYPES } from 'constants/entity.constants';
import { FullRoute, Route } from 'models/route.models';
import { Wpt } from 'models/entities.models';
import { CreateOrUpdateRouteDto, RouteLegDto } from 'dtos/route.dtos';
import { CreateRouteWptDto } from 'dtos/entities.dtos';
import { TransactionContext, UnitOfWork } from 'database/database.types';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { ROUTE_LIMITS } from 'constants/entity.constants';
import {
  applyRouteUpdate,
  routeAsCreateOrUpdateDto,
  createOrUpdateRouteFromDto
} from 'mappers/route.mapper';
import { isStakeEntity } from 'models/common.entity.models';
import { EntityRepository } from 'repositories/entity.repository.interface';
import { EntityAdderService } from 'services/entity.adder.service';
import { EntityRetrieverService } from 'services/entity.retriever.service';
import { EntityUpdaterService } from 'services/entity.updater.service';
import { RouteWptService } from 'services/route.wpt.service';
import { AppLogger } from 'utils/logger.util';

export interface RouteService {
  getFullRoute(routeId: string): Promise<FullRoute | null>;
  addRoute(
    incomingRoute: CreateOrUpdateRouteDto,
    parentId: string,
    transactionContext?: TransactionContext
  ): Promise<Route>;
  updateRoute(incomingRoute: CreateOrUpdateRouteDto): Promise<Route>;
  cloneRoute(routeFromDb: Route): Promise<CreateOrUpdateRouteDto>;
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
    leg => wpts.some(wpt => wpt.id === leg.startWpt) && wpts.some(wpt => wpt.id === leg.endWpt)
  );

export const createRouteService = ({
  entityRepository,
  entityRetriever,
  entityAdder,
  entityUpdater,
  routeWptService,
  unitOfWork,
  logger
}: RouteServiceDeps): RouteService => {
  const getFullRoute = async (routeId: string): Promise<FullRoute | null> => {
    const route = await entityRetriever.findEntityOfType<Route>(ENTITY_TYPES.ROUTE, routeId);
    if (!route) return null;
    const routeWpts = await routeWptService.getRouteWpts(route);
    const fullRoute: FullRoute = { route, routeWpts };
    return fullRoute;
  };

  const addRoute = async (
    incomingRoute: CreateOrUpdateRouteDto,
    parentId: string,
    outerTransactionContext?: TransactionContext
  ): Promise<Route> => {
    logger.info({ parentId, routeId: incomingRoute.id }, 'Attempting to add a route');
    if (incomingRoute.wpts.length < ROUTE_LIMITS.MIN_WPTS) {
      throw new BadRequestError(ERROR_MESSAGES.ROUTE_MIN_WPTS);
    }

    const newRoute = createOrUpdateRouteFromDto(incomingRoute);
    const doSave = async (transactionContext: TransactionContext) => {
      const existingRoute = await entityRetriever.findEntityOfType<Route>(
        ENTITY_TYPES.ROUTE,
        newRoute.id
      );
      if (existingRoute) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_ALREADY_EXISTS(incomingRoute.id));
      }
      await routeWptService.createWptsForRoute(incomingRoute.wpts, newRoute, transactionContext);
      if (!areLegsValid(incomingRoute.legs, incomingRoute.wpts)) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_CREATE_INVALID_LEGS);
      }
      return entityAdder.addEntity(newRoute, parentId, transactionContext);
    };
    return outerTransactionContext
      ? doSave(outerTransactionContext)
      : unitOfWork.run(doSave);
  };

  const updateRoute = async (incomingRoute: CreateOrUpdateRouteDto): Promise<Route> => {
    logger.info(
      { routeId: incomingRoute.id, parentId: incomingRoute.parentId },
      'Attempting to update a route'
    );
    if (incomingRoute.wpts.length < ROUTE_LIMITS.MIN_WPTS) {
      throw new BadRequestError(ERROR_MESSAGES.ROUTE_MIN_WPTS);
    }

    const currentRoute = await entityRetriever.findEntityOfType<Route>(
      ENTITY_TYPES.ROUTE,
      incomingRoute.id
    );
    if (!currentRoute) {
      throw new BadRequestError(
        ERROR_MESSAGES.ENTITY_UPDATE_NOT_FOUND(
          ENTITY_TYPES.ROUTE,
          incomingRoute.id,
          incomingRoute.parentId
        )
      );
    }

    return unitOfWork.run(async transactionContext => {
      const withoutWpts = await routeWptService.removeWpts(
        currentRoute,
        incomingRoute,
        transactionContext
      );
      await routeWptService.createWptsForRoute(incomingRoute.wpts, withoutWpts, transactionContext);
      if (!areLegsValid(incomingRoute.legs, incomingRoute.wpts)) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_UPDATE_INVALID_LEGS);
      }
      const updatedRoute = applyRouteUpdate(withoutWpts, incomingRoute);
      return entityUpdater.updateEntity(incomingRoute.parentId, updatedRoute, transactionContext);
    });
  };

  const cloneRoute = async (routeFromDb: Route): Promise<CreateOrUpdateRouteDto> => {
    logger.info(
      { parentId: routeFromDb.parentId, routeId: routeFromDb.id },
      'Attempting to clone a route'
    );
    const allWpts = (
      await entityRepository.findByType(ENTITY_TYPES.NAVIGATION_WAY_POINT)
    ) as Wpt[];

    const newWpts: Wpt[] = [];
    const oldIdToNewWpt = new Map<string, Wpt>();

    routeFromDb.wptsIds.forEach(oldWptId => {
      const oldWpt = allWpts.find(wpt => wpt.id === oldWptId);
      if (!oldWpt) {
        throw new BadRequestError(
          ERROR_MESSAGES.ROUTE_CLONE_WPT_ID_MISSING(oldWptId, routeFromDb.parentId)
        );
      }

      const newWpt = allWpts.find(
        wpt =>
          wpt.name === oldWpt.name &&
          (isStakeEntity(oldWpt.category) || wpt.parentId === routeFromDb.parentId) &&
          wpt.id !== oldWptId
      );
      if (!newWpt) {
        throw new BadRequestError(
          ERROR_MESSAGES.ROUTE_CLONE_WPT_NAME_MISSING(oldWpt.name, routeFromDb.parentId)
        );
      }

      newWpts.push(newWpt);
      oldIdToNewWpt.set(oldWpt.id, newWpt);
    });

    const remappedLegsRoute = getRemappedLegsRoute(routeFromDb, oldIdToNewWpt);
    return routeAsCreateOrUpdateDto(remappedLegsRoute, newWpts);
  };

  return {
    getFullRoute,
    addRoute,
    updateRoute,
    cloneRoute
  };
};

const getRemappedLegsRoute = (routeFromDb: Route, oldIdToNewWpt: Map<string, Wpt>): Route => {
  const remappedRoute = { ...routeFromDb, legs: routeFromDb.legs.map(leg => ({ ...leg })) };
  remappedRoute.legs.forEach(leg => {
    if (remappedRoute.zmmWptId === leg.endWpt) {
      remappedRoute.zmmWptId = oldIdToNewWpt.get(leg.endWpt)?.id ?? remappedRoute.zmmWptId;
    }
    leg.startWpt = oldIdToNewWpt.get(leg.startWpt)?.id ?? leg.startWpt;
    leg.endWpt = oldIdToNewWpt.get(leg.endWpt)?.id ?? leg.endWpt;
  });

  return remappedRoute;
};
