import { Mission, MissionBase } from 'models/mission.models';
import { CreateMissionDto, UpdateMissionDto } from 'dtos/mission.dtos';
import { MissionRepository } from 'repositories/mission.repository';
import { EntityRepository } from 'repositories/entity.repository';
import { StakeRepository } from 'repositories/stake.repository';
import { MissionService } from 'services/mission.service';
import { CommonActionsService } from 'services/common-actions.service';
import { RouteService } from 'services/route.service';
import { TransactionContext, UnitOfWork } from 'database/database.types';
import { AppLogger } from 'utils/logger.util';

export const MISSION_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
export const OTHER_MISSION_ID = '9b2f6a10-1234-4c4d-8e11-aa22bb33cc44';
export const MISSION_NAME = 'Operation Alpha';
export const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

export const buildMission = (overrides: Partial<Mission> = {}): Mission => ({
  id: MISSION_ID,
  timeInfo: { dateCreated: FIXED_DATE, lastUpdateTime: FIXED_DATE },
  name: MISSION_NAME,
  comment: 'a comment',
  createdBy: 'tester',
  missionType: 'Training',
  password: 'secret',
  attachedMissionId: undefined,
  versionNumber: 1,
  sonicProperties: undefined,
  ...overrides,
});

export const buildMissionBase = (overrides: Partial<MissionBase> = {}): MissionBase => {
  const { versionNumber: _v, sonicProperties: _s, ...base } = buildMission();
  return { ...base, ...overrides };
};

export const buildCreateMissionDto = (overrides: Partial<CreateMissionDto> = {}): CreateMissionDto => ({
  name: MISSION_NAME,
  comment: 'a comment',
  createdBy: 'tester',
  missionType: 'Training',
  password: 'secret',
  sonicProperties: undefined,
  attachedMissionId: undefined,
  ...overrides,
});

export const buildUpdateMissionDto = (overrides: Partial<UpdateMissionDto> = {}): UpdateMissionDto => ({
  id: MISSION_ID,
  name: MISSION_NAME,
  comment: 'a comment',
  createdBy: 'tester',
  missionType: 'Training',
  password: 'secret',
  attachedMissionId: undefined,
  ...overrides,
});

export const createMissionRepositoryMock = (): jest.Mocked<MissionRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
  findAllBasic: jest.fn(),
  findAllNames: jest.fn(),
  findIdByName: jest.fn(),
  searchByName: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

export const createEntityRepositoryMock = (): jest.Mocked<EntityRepository> => ({
  insert: jest.fn(),
  findById: jest.fn(),
  findByParentId: jest.fn(),
  findByType: jest.fn(),
  findNamesByParentId: jest.fn(),
  isNameTaken: jest.fn(),
  update: jest.fn(),
  deleteById: jest.fn(),
  deleteByParentId: jest.fn(),
});

export const createStakeRepositoryMock = (): jest.Mocked<StakeRepository> => ({
  insert: jest.fn(),
  findById: jest.fn(),
  findByPatrickName: jest.fn(),
  update: jest.fn(),
});

export const createCommonActionsMock = (): jest.Mocked<CommonActionsService> => ({
  validateParentExists: jest.fn(),
  bumpParentVersion: jest.fn(),
});

export const createRouteServiceMock = (): jest.Mocked<RouteService> => ({
  getFullRoute: jest.fn(),
  addRoute: jest.fn(),
  updateRoute: jest.fn(),
  cloneRoute: jest.fn(),
});

export type UnitOfWorkMock = UnitOfWork & { run: jest.Mock };

export const createUnitOfWorkMock = (): UnitOfWorkMock => {
  const run = jest.fn(async (work: (context: TransactionContext) => Promise<unknown>) => work({}));
  return { run } as unknown as UnitOfWorkMock;
};

export const createLoggerMock = (): jest.Mocked<AppLogger> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

export const createMissionServiceMock = (): jest.Mocked<MissionService> =>
  ({
    createMission: jest.fn(),
    findMission: jest.fn(),
    findMissionWithEntities: jest.fn(),
    updateMission: jest.fn(),
    deleteMission: jest.fn(),
    cloneMission: jest.fn(),
    mergeMission: jest.fn(),
    importMissions: jest.fn(),
    addEntities: jest.fn(),
    retrieveAll: jest.fn(),
    retrieveAllInList: jest.fn(),
    searchMissionsByName: jest.fn(),
    generateNextEntityNames: jest.fn(),
    generateNextMissionName: jest.fn(),
  }) as unknown as jest.Mocked<MissionService>;
