import { createEntityAdderService } from 'services/entity-adder.service';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import {
  MISSION_ID,
  createCommonActionsMock,
  createEntityRepositoryMock,
  createLoggerMock,
} from '../fixtures/mission.fixtures';
import { buildCircle } from '../fixtures/entity.fixtures';

describe('entity-adder.service', () => {
  const entityRepository = createEntityRepositoryMock();
  const commonActions = createCommonActionsMock();
  const logger = createLoggerMock();

  const service = createEntityAdderService({ entityRepository, commonActions, logger });

  it('inserts the entity and bumps the parent version', async () => {
    const circle = buildCircle();
    entityRepository.isNameTaken.mockResolvedValue(false);
    entityRepository.insert.mockResolvedValue(circle);

    const result = await service.addEntity(circle, MISSION_ID);

    expect(result).toEqual(circle);
    expect(commonActions.validateParentExists).toHaveBeenCalledWith(MISSION_ID);
    expect(entityRepository.insert).toHaveBeenCalledWith(circle, undefined);
    expect(commonActions.bumpParentVersion).toHaveBeenCalledWith(MISSION_ID, undefined);
  });

  it('rejects an entity whose name is already taken in the parent', async () => {
    const circle = buildCircle();
    entityRepository.isNameTaken.mockResolvedValue(true);

    await expect(service.addEntity(circle, MISSION_ID)).rejects.toThrow(
      ERROR_MESSAGES.ENTITY_NAME_EXISTS(circle.entityType, circle.name, MISSION_ID),
    );
    expect(entityRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects an entity with a blank name', async () => {
    const circle = buildCircle({ name: '   ' });

    await expect(service.addEntity(circle, MISSION_ID)).rejects.toBeInstanceOf(BadRequestError);
    expect(entityRepository.isNameTaken).not.toHaveBeenCalled();
  });

  it('passes the transaction context through to the repository', async () => {
    const circle = buildCircle();
    const context = { raw: 'session' };
    entityRepository.isNameTaken.mockResolvedValue(false);
    entityRepository.insert.mockResolvedValue(circle);

    await service.addEntity(circle, MISSION_ID, context);

    expect(entityRepository.insert).toHaveBeenCalledWith(circle, context);
  });
});
