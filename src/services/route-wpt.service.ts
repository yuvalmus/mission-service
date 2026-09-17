import { ENTITY_TYPES } from 'constants/entity.constants';
import { Route } from 'models/route.models';
import { Wpt } from 'models/points.models';
import { BasicEntityDto } from 'dtos/entity.dtos';
import { CreateOrUpdateRouteDto } from 'dtos/route.dtos';
import { CreateRouteWptDto } from 'dtos/points.dtos';
import { EntityRepository } from 'repositories/entity.repository';
import { TransactionContext } from 'database/database.types';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { toBasicEntityDto } from 'mappers/entity.mapper';
import {
  applyRouteWptUpdate,
  wptEqualsRouteWptDto,
  wptFromRouteWptDto
} from 'mappers/points.mapper';
import { CommonActionsService } from 'services/common-actions.service';
import { EntityAdderService } from 'services/entity-adder.service';

export interface RouteWptService {
  getRouteWpts(route: Route): Promise<Wpt[]>;
  getRouteWptsAsBasicDtos(route: Route): Promise<BasicEntityDto[]>;
  removeWpts(
    route: Route,
    dto: CreateOrUpdateRouteDto,
    context: TransactionContext
  ): Promise<Route>;
  createWptsForRoute(
    routeWpts: CreateRouteWptDto[],
    route: Route,
    context: TransactionContext
  ): Promise<Route>;
  updateExistingWpt(
    existingWpt: Wpt,
    dto: CreateRouteWptDto,
    route: Route,
    context: TransactionContext
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
    const wpts = await findAllWpts();
    return wpts
      .filter(wpt => route.wptsIds.includes(wpt.id))
      .sort((a, b) => route.wptsIds.indexOf(a.id) - route.wptsIds.indexOf(b.id));
  };

  const updateExistingWpt = async (
    existingWpt: Wpt,
    dto: CreateRouteWptDto,
    route: Route,
    context: TransactionContext
  ): Promise<void> => {
    const updated = { ...existingWpt, connectedRoutes: [...existingWpt.connectedRoutes] };

    if (updated.category === 'linePoint') {
      if (updated.connectedRoutes.some(routeId => routeId !== route.id)) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_WPT_IN_OTHER_ROUTE(dto.id));
      }
      if (updated.connectedRoutes.length === 0) {
        updated.connectedRoutes.push(route.id);
      }
      const withDtoFields = applyRouteWptUpdate(updated, dto);
      await entityRepository.update(withDtoFields, context);
      await commonActions.bumpParentVersion(withDtoFields.parentId, context);
      return;
    }

    if (!wptEqualsRouteWptDto(updated, dto)) {
      throw new BadRequestError(ERROR_MESSAGES.ROUTE_WPT_NOT_UPDATABLE(updated.category));
    }

    updated.connectedRoutes.push(route.id);
    await entityRepository.update(updated, context);
    await commonActions.bumpParentVersion(updated.parentId, context);
  };

  return {
    getRouteWpts,

    getRouteWptsAsBasicDtos: async route => {
      const wpts = await getRouteWpts(route);
      return route.wptsIds
        .map(wptId => wpts.find(wpt => wpt.id === wptId))
        .filter((wpt): wpt is Wpt => wpt !== undefined)
        .map(toBasicEntityDto);
    },

    removeWpts: async (route, dto, context) => {
      const wpts = await findAllWpts();

      for (const wptId of route.wptsIds) {
        const wpt = wpts.find(candidate => candidate.id === wptId);
        if (!wpt || dto.wpts.some(dtoWpt => dtoWpt.id === wpt.id)) continue;

        if (wpt.category === 'linePoint') {
          await entityRepository.deleteById(wpt.id, context);
          await commonActions.bumpParentVersion(dto.parentId, context);
        } else {
          const connectedRoutes = [...wpt.connectedRoutes];
          const routeIndex = connectedRoutes.indexOf(route.id);
          if (routeIndex >= 0) connectedRoutes.splice(routeIndex, 1);
          await entityRepository.update({ ...wpt, connectedRoutes }, context);
          await commonActions.bumpParentVersion(wpt.parentId, context);
        }
      }

      return { ...route, wptsIds: [] };
    },

    createWptsForRoute: async (routeWpts, route, context) => {
      if (!areRouteWptsValid(routeWpts)) {
        throw new BadRequestError(ERROR_MESSAGES.ROUTE_WPTS_DUPLICATED);
      }

      const wpts = await findAllWpts();
      for (const dtoWpt of routeWpts) {
        const existingWpt = wpts.find(wpt => wpt.id === dtoWpt.id);
        if (existingWpt) {
          await updateExistingWpt(existingWpt, dtoWpt, route, context);
        } else {
          const newWpt = wptFromRouteWptDto(dtoWpt);
          newWpt.connectedRoutes.push(route.id);
          await entityAdder.addEntity(newWpt, newWpt.parentId, context);
        }
      }
      return route;
    },

    updateExistingWpt
  };
};
