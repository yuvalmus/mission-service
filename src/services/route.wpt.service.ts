import { ENTITY_TYPES, WPT_CATEGORIES } from 'constants/entity.constants';
import { Route } from 'models/route.models';
import { Wpt } from 'models/entities.models';
import { BasicEntityDto } from 'dtos/commonEntity.dtos';
import { CreateOrUpdateRouteDto } from 'dtos/route.dtos';
import { CreateRouteWptDto } from 'dtos/entities.dtos';
import { EntityRepository } from 'repositories/entity.repository.interface';
import { TransactionContext } from 'database/database.types';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { toBasicEntityDto } from 'mappers/common.entity.mapper';
import {
  applyRouteWptUpdate,
  wptEqualsRouteWptDto,
  wptFromRouteWptDto
} from 'mappers/entities.mapper';
import { CommonActionsService } from 'services/common.actions.service';
import { EntityAdderService } from 'services/entity.adder.service';

export interface RouteWptService {
  getRouteWpts(route: Route): Promise<Wpt[]>;
  getRouteWptsAsBasicDtos(route: Route): Promise<BasicEntityDto[]>;
  removeWpts(
    currentRoute: Route,
    incomingRoute: CreateOrUpdateRouteDto,
    transactionContext: TransactionContext
  ): Promise<Route>;
  createWptsForRoute(
    incomingRouteWpts: CreateRouteWptDto[],
    wptsLinkedRoute: Route,
    transactionContext: TransactionContext
  ): Promise<Route>;
  updateExistingWpt(
    existingWpt: Wpt,
    incomingRouteWpt: CreateRouteWptDto,
    wptsLinkedRoute: Route,
    transactionContext: TransactionContext
  ): Promise<void>;
  updateExistingWptOfRoute(
    existingWpt: Wpt,
    incomingRouteWpt: CreateRouteWptDto,
    wptsLinkedRoute: Route,
    transactionContext: TransactionContext
  ): Promise<void>;
}

export interface RouteWptServiceDeps {
  entityRepository: EntityRepository;
  entityAdder: EntityAdderService;
  commonActions: CommonActionsService;
}

const areRouteWptsValid = (wpts: readonly CreateRouteWptDto[]): boolean => {
  const names = new Set(wpts.map(wpt => wpt.name));
  const ids = new Set(wpts.map(wpt => wpt.id));
  return names.size === wpts.length && ids.size === wpts.length;
};

export const createRouteWptService = ({
  entityRepository,
  entityAdder,
  commonActions
}: RouteWptServiceDeps): RouteWptService => {
  const findAllWpts = async (): Promise<Wpt[]> =>
    (await entityRepository.findByType(ENTITY_TYPES.NAVIGATION_WAY_POINT)) as Wpt[];

  const getRouteWpts = async (route: Route): Promise<Wpt[]> => {
    const allWpts = await findAllWpts();
    return allWpts
      .filter(wpt => route.wptsIds.includes(wpt.id))
      .sort((a, b) => route.wptsIds.indexOf(a.id) - route.wptsIds.indexOf(b.id));
  };

  const updateExistingWpt = async (
    existingWpt: Wpt,
    incomingRouteWpt: CreateRouteWptDto,
    wptsLinkedRoute: Route,
    transactionContext: TransactionContext
  ): Promise<void> => {
    const updated = { ...existingWpt, connectedRoutes: [...existingWpt.connectedRoutes] };

    if (!wptEqualsRouteWptDto(updated, incomingRouteWpt)) {
      throw new BadRequestError(ERROR_MESSAGES.ROUTE_WPT_NOT_UPDATABLE(updated.category));
    }

    updated.connectedRoutes.push(wptsLinkedRoute.id);
    await entityRepository.update(updated, transactionContext);
    await commonActions.bumpParentVersion(updated.parentId, transactionContext);
  };

  const updateExistingWptOfRoute = async (
    existingWpt: Wpt,
    incomingRouteWpt: CreateRouteWptDto,
    wptsLinkedRoute: Route,
    transactionContext: TransactionContext
  ): Promise<void> => {
    const updated = { ...existingWpt, connectedRoutes: [...existingWpt.connectedRoutes] };

    if (updated.connectedRoutes.some(routeId => routeId !== wptsLinkedRoute.id)) {
      throw new BadRequestError(ERROR_MESSAGES.ROUTE_WPT_IN_OTHER_ROUTE(incomingRouteWpt.id));
    }
    if (updated.connectedRoutes.length === 0) {
      updated.connectedRoutes.push(wptsLinkedRoute.id);
    }
    const withDtoFields = applyRouteWptUpdate(updated, incomingRouteWpt);
    await entityRepository.update(withDtoFields, transactionContext);
    await commonActions.bumpParentVersion(withDtoFields.parentId, transactionContext);
    return;
  };

  const getRouteWptsAsBasicDtos = async (route: Route) => {
    const wpts = await getRouteWpts(route);
    return route.wptsIds
      .map(wptId => wpts.find(wpt => wpt.id === wptId))
      .filter((wpt): wpt is Wpt => wpt !== undefined)
      .map(toBasicEntityDto);
  };

  const removeWpts = async (
    currentRoute: Route,
    incomingRoute: CreateOrUpdateRouteDto,
    transactionContext: TransactionContext
  ) => {
    const allWpts = await findAllWpts();

    for (const wptId of currentRoute.wptsIds) {
      const wpt = allWpts.find(candidate => candidate.id === wptId);
      if (!wpt || incomingRoute.wpts.some(incomingRouteWpt => incomingRouteWpt.id === wpt.id))
        continue;

      if (wpt.category === WPT_CATEGORIES.LINE_POINT) {
        await entityRepository.deleteById(wpt.id, transactionContext);
        await commonActions.bumpParentVersion(incomingRoute.parentId, transactionContext);
      } else {
        const connectedRoutes = [...wpt.connectedRoutes];
        const routeIndex = connectedRoutes.indexOf(currentRoute.id);
        if (routeIndex >= 0) connectedRoutes.splice(routeIndex, 1);
        await entityRepository.update({ ...wpt, connectedRoutes }, transactionContext);
        await commonActions.bumpParentVersion(wpt.parentId, transactionContext);
      }
    }

    return { ...currentRoute, wptsIds: [] };
  };

  const createWptsForRoute = async (
    incomingRouteWpts: CreateRouteWptDto[],
    wptsLinkedRoute: Route,
    transactionContext: TransactionContext
  ) => {
    if (!areRouteWptsValid(incomingRouteWpts)) {
      throw new BadRequestError(ERROR_MESSAGES.ROUTE_WPTS_DUPLICATED);
    }

    const allWpts = await findAllWpts();
    for (const incomingRouteWpt of incomingRouteWpts) {
      const existingWpt = allWpts.find(wpt => wpt.id === incomingRouteWpt.id);
      if (existingWpt) {
        if (existingWpt.category === WPT_CATEGORIES.LINE_POINT)
          await updateExistingWptOfRoute(existingWpt, incomingRouteWpt, wptsLinkedRoute, transactionContext);
        else await updateExistingWpt(existingWpt, incomingRouteWpt, wptsLinkedRoute, transactionContext);
      } else {
        const newWpt = wptFromRouteWptDto(incomingRouteWpt);
        newWpt.connectedRoutes.push(wptsLinkedRoute.id);
        await entityAdder.addEntity(newWpt, newWpt.parentId, transactionContext);
      }
    }
    return wptsLinkedRoute;
  };

  return {
    getRouteWpts,
    getRouteWptsAsBasicDtos,
    removeWpts,
    createWptsForRoute,
    updateExistingWpt,
    updateExistingWptOfRoute
  };
};
