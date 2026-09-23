export const LIKE_ESCAPE_CHARACTER = '\\';

const LIKE_WILDCARDS = /[\\%_]/g;

/**
 * Neutralises `%`, `_` and the escape character so a user-supplied search term is matched
 * literally by `ILIKE`, the same guarantee `escapeRegex` gives the Mongo backend.
 */
export const escapeLikePattern = (value: string): string =>
  value.replace(LIKE_WILDCARDS, (match) => `${LIKE_ESCAPE_CHARACTER}${match}`);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every identifier in the mesh is a UUID v4 — the schema forbids serial keys so that two
 * disconnected stations can mint rows without ever colliding. Ids are checked before they reach a
 * `uuid` column so a malformed one reads as "not found" instead of raising a type error.
 */
export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);
