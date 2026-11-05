import { ENTITY_DEFINITIONS, getEntityDefinition } from 'mappers/entity.registry';
import { ENTITY_TYPES } from 'constants/entity.constants';

const NON_ROUTE_ENTITY_TYPES = (Object.values(ENTITY_TYPES) as string[]).filter(
  value => value !== ENTITY_TYPES.ROUTE
);

describe('entity.registry', () => {
  describe('ENTITY_DEFINITIONS', () => {
    it('is keyed by every non-route entity type', () => {
      const keys = Object.keys(ENTITY_DEFINITIONS).sort();
      expect(keys).toEqual([...NON_ROUTE_ENTITY_TYPES].sort());
    });

    it('has an entityTypeSegment matching its key for every type', () => {
      Object.entries(ENTITY_DEFINITIONS).forEach(([key, definition]) => {
        expect(definition.entityTypeSegment).toBe(key);
      });
    });

    it('has an entityType matching its key for every type', () => {
      Object.entries(ENTITY_DEFINITIONS).forEach(([key, definition]) => {
        expect(definition.entityType).toBe(key);
      });
    });
  });

  describe('getEntityDefinition', () => {
    it('returns the definition registered for the type', () => {
      const definition = getEntityDefinition(ENTITY_TYPES.CIRCLE);
      expect(definition.entityType).toBe(ENTITY_TYPES.CIRCLE);
      expect(definition.entityTypeSegment).toBe(ENTITY_TYPES.CIRCLE);
    });

    it('throws for an unregistered type', () => {
      expect(() => getEntityDefinition(ENTITY_TYPES.ROUTE)).toThrow(
        `No entity definition registered for type ${ENTITY_TYPES.ROUTE}`
      );
    });
  });
});