import { Request } from 'express';
import { STAKE_PATH_MARKER } from 'constants/app.constants';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { BadRequestError } from 'errors/app.errors';
import { isStakeCategory } from 'models/entity.models';

export const isStakePath = (req: Pick<Request, 'baseUrl' | 'path'>): boolean =>
  `${req.baseUrl}${req.path}`.includes(STAKE_PATH_MARKER);

export const validateStakeCategory = (category: string, isStakeRoute: boolean): void => {
  const stakeCategory = isStakeCategory(category);

  if (isStakeRoute && !stakeCategory) {
    throw new BadRequestError(ERROR_MESSAGES.NON_STAKE_CATEGORY_ON_STAKE_PATH);
  }
  if (!isStakeRoute && stakeCategory) {
    throw new BadRequestError(ERROR_MESSAGES.STAKE_CATEGORY_ON_NON_STAKE_PATH);
  }
};

export const validateCategoryPath = (category: string, req: Pick<Request, 'baseUrl' | 'path'>): void => {
  validateStakeCategory(category, isStakePath(req));
};
