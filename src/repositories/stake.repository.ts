import { Squadron, Stake } from '@models/stake.models';

export interface StakeRepository {
  insert(stake: Stake): Promise<Stake>;
  findById(id: string): Promise<Stake | null>;
  findBySquadronName(squadronName: Squadron): Promise<Stake | null>;
  update(stake: Stake): Promise<Stake>;
}
