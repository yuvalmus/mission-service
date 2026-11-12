import { EntityType } from 'constants/entity.constants';
import { Entity } from 'models/entity.union.models';
import { TransactionContext } from 'database/database.types';

export interface EntityRepository {
  insert(entity: Entity, context?: TransactionContext): Promise<Entity>;
  findById(id: string): Promise<Entity | null>;
  findByParentId(parentId: string): Promise<Entity[]>;
  findByType(entityType: EntityType): Promise<Entity[]>;
  findNamesByParentId(parentId: string): Promise<string[]>;
  isNameExists(parentId: string, entityId: string, name: string): Promise<boolean>;
  update(entity: Entity, context?: TransactionContext): Promise<Entity>;
  deleteById(id: string, context?: TransactionContext): Promise<boolean>;
  deleteByParentId(parentId: string, context?: TransactionContext): Promise<boolean>;
}
