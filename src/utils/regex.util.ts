const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const ESCAPED_CHAR = '\\$&';

export const escapeRegex = (value: string): string => value.replace(REGEX_SPECIAL_CHARS, ESCAPED_CHAR);
