import { Router } from 'express';
import { MissionController } from '@controllers/mission.controller';
import { validate } from '@middlewares/validation.middleware';
import { MISSION_ROUTES } from '@constants/app.constants';
import {
  CreateMissionDtoSchema,
  MergeMissionDtoSchema,
  MissionDtoListSchema,
  MissionIdListDtoSchema,
  MissionIdParamsSchema,
  SearchNameParamsSchema,
  UpdateMissionDtoSchema,
} from '@dtos/mission.dtos';

export const createMissionRoutes = (controller: MissionController): Router => {
  const router = Router();

  router.get(MISSION_ROUTES.AS_BASIC, controller.getAllBasic);
  router.get(MISSION_ROUTES.SEARCH, validate({ params: SearchNameParamsSchema }), controller.searchByName);
  router.get(MISSION_ROUTES.BY_ID, validate({ params: MissionIdParamsSchema }), controller.getMission);

  router.post(MISSION_ROUTES.FROM_IDS_AS_BASIC, validate({ body: MissionIdListDtoSchema }), controller.getBasicMissionsFromIds);
  router.post(MISSION_ROUTES.FROM_IDS, validate({ body: MissionIdListDtoSchema }), controller.getMissionsFromIds);
  router.post(MISSION_ROUTES.LIST, validate({ body: MissionDtoListSchema }), controller.importMissions);
  router.post(MISSION_ROUTES.CLONE, validate({ params: MissionIdParamsSchema }), controller.cloneMission);
  router.post(MISSION_ROUTES.ROOT, validate({ body: CreateMissionDtoSchema }), controller.createMission);

  router.put(MISSION_ROUTES.MERGE, validate({ body: MergeMissionDtoSchema }), controller.mergeMission);
  router.put(MISSION_ROUTES.ROOT, validate({ body: UpdateMissionDtoSchema }), controller.updateMission);

  router.delete(MISSION_ROUTES.BY_ID, validate({ params: MissionIdParamsSchema }), controller.deleteMission);

  return router;
};
