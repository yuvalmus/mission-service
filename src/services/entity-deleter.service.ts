import { randomUUID } from 'node:crypto';
import { ENTITY_TYPES, EntityType } from 'constants/entity.constants';
import { Route } from 'models/route.models';
import { Wpt } from 'models/points.models';
import { isEntrecoteEntity } from 'models/entity.models';
import { EntityRepository } from 'repositories/entity.repository';
import { TransactionContext, UnitOfWork } from 'database/database.types';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { validateStakeCategory } from 'utils/category.util';
import { CommonActionsService } from 'services/common-actions.service';
import { EntityAdderService } from 'services/entity-adder.service';
import { EntityRetrieverService } from 'services/entity-retriever.service';
import { AppLogger } from 'utils/logger.util';

export interface EntityDeleterService {
  deleteEntity(entityType: EntityType, missionId: string, id: string, isStakePath: boolean): Promise<boolean>;
  deleteRoute(missionId: string, id: string, isStakePath: boolean): Promise<boolean>;
}

export interface EntityDeleterServiceDeps {
  entityRepository: EntityRepository;
  entityRetriever: EntityRetrieverService;
  entityAdder: EntityAdderService;
  commonActions: CommonActionsService;
  unitOfWork: UnitOfWork;
  logger: AppLogger;
}

export const createEntityDeleterService = ({
  entityRepository,
  entityRetriever,
  entityAdder,
  commonActions,
  unitOfWork,
  logger,
}: EntityDeleterServiceDeps): EntityDeleterService => {
  const deleteAndBump = async (id: string, parentId: string, context?: TransactionContext): Promise<boolean> => {
    const deleted = await entityRepository.deleteById(id, context);
    await commonActions.bumpParentVersion(parentId, context);
    return deleted;
  };

  const deleteStakeWpt = async (wpt: Wpt, context: TransactionContext): Promise<boolean> => {
    const routes = (await entityRepository.findByType(ENTITY_TYPES.ROUTE)) as Route[];
    const referencingRoutes = routes.filter((route) => route.wptsIds.includes(wpt.id));

    const routesByMission = new Map<string, Route[]>();
    referencingRoutes.forEach((route) => {
      routesByMission.set(route.parentId, [...(routesByMission.get(route.parentId) ?? []), route]);
    });

    for (const [missionId, missionRoutes] of routesByMission) {
      const duplicatedWpt: Wpt = {
        ...wpt,
        id: randomUUID(),
        parentId: missionId,
        connectedRoutes: missionRoutes.map((route) => route.id),
      };
      for (const route of missionRoutes) {
        const remapped = {
          ...route,
          wptsIds: route.wptsIds.map((wptId) => (wptId === wpt.id ? duplicatedWpt.id : wptId)),
        };
        await entityRepository.update(remapped, context);
        await commonActions.bumpParentVersion(remapped.parentId, context);
      }
      await entityAdder.addEntity(duplicatedWpt, duplicatedWpt.parentId, context);
    }

    return deleteAndBump(wpt.id, wpt.parentId, context);
  };

  const deleteWpt = async (missionId: string, id: string, isStakePath: boolean): Promise<boolean> => {
    const wpt = await entityRetriever.findEntityOfType<Wpt>(ENTITY_TYPES.NAVIGATION_WAY_POINT, id);
    if (!wpt) {
      throw new BadRequestError(ERROR_MESSAGES.ENTITY_NOT_FOUND(ENTITY_TYPES.NAVIGATION_WAY_POINT, id, missionId));
    }
    validateStakeCategory(wpt.category, isStakePath);

    if (isEntrecoteEntity(wpt) && wpt.connectedRoutes.length > 0) {
      return unitOfWork.run((context) => deleteStakeWpt(wpt, context));
    }

    if (wpt.category === 'user' && wpt.connectedRoutes.length > 0) {
      const routes = (await entityRepository.findByType(ENTITY_TYPES.ROUTE)) as Route[];
      const connectedRouteNames = routes
        .filter((route) => wpt.connectedRoutes.includes(route.id))
        .map((route) => route.name);
      throw new BadRequestError(ERROR_MESSAGES.WPT_CONNECTED_TO_ROUTES(connectedRouteNames));
    }

    return deleteAndBump(id, missionId);
  };

  return {
    deleteEntity: async (entityType, missionId, id, isStakePath) => {
      logger.info({ entityType, id, missionId }, 'Attempting to delete an entity');
      if (entityType === ENTITY_TYPES.NAVIGATION_WAY_POINT) {
        return deleteWpt(missionId, id, isStakePath);
      }

      const entity = await entityRetriever.findEntity(id);
      if (!entity) {
        throw new BadRequestError(ERROR_MESSAGES.ENTITY_NOT_FOUND('Entity', id, missionId));
      }
      validateStakeCategory(entity.category, isStakePath);
      return deleteAndBump(id, missionId);
    },

    deleteRoute: async (missionId, id, isStakePath) => {
      logger.info({ id, missionId }, 'Attempting to delete a route');
      const route = await entityRetriever.findEntityOfType<Route>(ENTITY_TYPES.ROUTE, id);
      if (!route) {
        throw new BadRequestError(ERROR_MESSAGES.ENTITY_NOT_FOUND(ENTITY_TYPES.ROUTE, id, missionId));
      }
      validateStakeCategory(route.category, isStakePath);

      return unitOfWork.run(async (context) => {
        for (const wptId of route.wptsIds) {
          const wpt = await entityRetriever.findEntityOfType<Wpt>(ENTITY_TYPES.NAVIGATION_WAY_POINT, wptId);
          if (!wpt) {
            logger.warn({ wptId, routeId: id }, 'Route wpt was not found during route deletion');
            continue;
          }
          if (wpt.category === 'linePoint' || (isEntrecoteEntity(wpt) && wpt.parentId === missionId)) {
            await deleteAndBump(wpt.id, missionId, context);
          } else {
            const connectedRoutes = [...wpt.connectedRoutes];
            const routeIndex = connectedRoutes.indexOf(route.id);
            if (routeIndex >= 0) connectedRoutes.splice(routeIndex, 1);
            await entityRepository.update({ ...wpt, connectedRoutes }, context);
            await commonActions.bumpParentVersion(wpt.parentId, context);
          }
        }
        await deleteAndBump(id, missionId, context);
        return true;
      });
    },
  };
};
