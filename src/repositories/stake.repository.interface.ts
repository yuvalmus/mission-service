import { Patrick, Stake } from 'models/stake.models';
import { TransactionContext } from 'database/database.types';

export interface StakeRepository {
  insert(stake: Stake): Promise<Stake>;
  findById(id: string): Promise<Stake | null>;
  findByPatrickName(patrickName: Patrick): Promise<Stake | null>;
  update(stake: Stake, context?: TransactionContext): Promise<Stake>;
  bumpVersion(id: string, context?: TransactionContext): Promise<boolean>;
}
