import { Patrick, Stake } from 'models/stake.models';

export interface StakeRepository {
  insert(stake: Stake): Promise<Stake>;
  findById(id: string): Promise<Stake | null>;
  findByPatrickName(patrickName: Patrick): Promise<Stake | null>;
  update(stake: Stake): Promise<Stake>;
}
