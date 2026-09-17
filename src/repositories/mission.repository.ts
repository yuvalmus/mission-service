import { Mission, MissionBase } from '@models/mission.models';
import { TransactionContext } from '@database/database.types';

export interface MissionRepository {
  create(mission: Mission): Promise<Mission>;
  findById(id: string): Promise<Mission | null>;
  findByIds(ids: readonly string[]): Promise<Mission[]>;
  findAllBasic(): Promise<MissionBase[]>;
  findAllNames(): Promise<string[]>;
  findIdByName(name: string): Promise<string | null>;
  searchByName(name: string): Promise<MissionBase[]>;
  update(mission: Mission): Promise<Mission>;
  delete(id: string, context?: TransactionContext): Promise<boolean>;
}

