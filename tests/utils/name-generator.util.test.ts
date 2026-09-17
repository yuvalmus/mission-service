import {
  generateNames,
  paddedFormatter,
  parenthesesFormatter,
  plainFormatter,
} from '@utils/name-generator.util';
import { NAME_GENERATION } from '@constants/app.constants';

describe('name-generator.util', () => {
  it('generates padded entity names by default', () => {
    expect(generateNames([], 'C', 1)).toEqual(['C001']);
  });

  it('skips names that already exist', () => {
    expect(generateNames(['C001', 'C002'], 'C', 1)).toEqual(['C003']);
  });

  it('generates multiple unique names in sequence', () => {
    expect(generateNames(['C001'], 'C', 3)).toEqual(['C002', 'C003', 'C004']);
  });

  it('supports the plain mission format', () => {
    const prefix = NAME_GENERATION.MISSION_PREFIX;
    expect(generateNames([`${prefix}1`], prefix, 1, plainFormatter)).toEqual([`${prefix}2`]);
  });

  it('supports the clone parentheses format', () => {
    expect(generateNames(['Alpha(1)'], 'Alpha', 1, parenthesesFormatter)).toEqual(['Alpha(2)']);
  });

  it('exposes stable formatters', () => {
    expect(paddedFormatter(7)).toBe('007');
    expect(plainFormatter(7)).toBe('7');
    expect(parenthesesFormatter(7)).toBe('(7)');
  });
});
