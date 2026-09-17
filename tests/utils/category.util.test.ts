import { isStakePath, validateStakeCategory } from 'utils/category.util';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';

describe('category.util', () => {
  describe('isStakePath', () => {
    it.each([
      ['/createStake', '/circle', true],
      ['/create', '/circle', false],
      ['/updateStake', '/wpt', true],
      ['/deleteStake', '/route/a/b', true],
      ['/entities', '/circle/1', false],
    ])('detects %s%s as stake=%s', (baseUrl, path, expected) => {
      expect(isStakePath({ baseUrl, path } as never)).toBe(expected);
    });
  });

  describe('validateStakeCategory', () => {
    it('allows a stake category on a stake path', () => {
      expect(() => validateStakeCategory('TrainingLow', true)).not.toThrow();
    });

    it('allows a non-stake category on a non-stake path', () => {
      expect(() => validateStakeCategory('General', false)).not.toThrow();
    });

    it('rejects a non-stake category on a stake path', () => {
      expect(() => validateStakeCategory('General', true)).toThrow(
        new BadRequestError(ERROR_MESSAGES.NON_STAKE_CATEGORY_ON_STAKE_PATH),
      );
    });

    it('rejects a stake category on a non-stake path', () => {
      expect(() => validateStakeCategory('TrainingLow', false)).toThrow(
        new BadRequestError(ERROR_MESSAGES.STAKE_CATEGORY_ON_NON_STAKE_PATH),
      );
    });
  });
});
