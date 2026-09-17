import { EntityType } from '@constants/entity.constants';
import { AnyEntity } from '@models/entity-union.models';
import { TransactionContext } from '@database/database.types';

export interface EntityRepository {
  insert(entity: AnyEntity, context?: TransactionContext): Promise<AnyEntity>;
  findById(id: string): Promise<AnyEntity | null>;
  findByParentId(parentId: string): Promise<AnyEntity[]>;
  findByType(entityType: EntityType): Promise<AnyEntity[]>;
  findNamesByParentId(parentId: string): Promise<string[]>;
  isNameTaken(parentId: string, entityId: string, name: string): Promise<boolean>;
  update(entity: AnyEntity, context?: TransactionContext): Promise<AnyEntity>;
  deleteById(id: string, context?: TransactionContext): Promise<boolean>;
  deleteByParentId(parentId: string, context?: TransactionContext): Promise<boolean>;
}
