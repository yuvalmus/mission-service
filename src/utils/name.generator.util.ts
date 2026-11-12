import { NAME_GENERATION } from 'constants/app.constants';

export type NameFormatter = (count: number) => string;

export const paddedFormatter: NameFormatter = (count) =>
  String(count).padStart(NAME_GENERATION.DEFAULT_PAD_LENGTH, '0');

export const plainFormatter: NameFormatter = (count) => String(count);

export const parenthesesFormatter: NameFormatter = (count) => `(${count})`;

export const generateNames = (
  existingNames: readonly string[],
  prefix: string,
  amount: number,
  format: NameFormatter = paddedFormatter,
): string[] => {
  const taken = new Set(existingNames);
  const suggested: string[] = [];
  const counter = { value: 1 };

  while (suggested.length < amount) {
    const name = prefix + `${format(counter.value)}`;
    counter.value += 1;
    if (!taken.has(name)) {
      suggested.push(name);
      taken.add(name);
    }
  }

  return suggested;
};
