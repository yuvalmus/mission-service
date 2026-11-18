import { Patrick, Stake, STAKE_CONSTANTS } from 'models/stake.models';

export interface InfraRow {
  id: string;
  squadron: string;
  version_number: number;
}

export const toStake = (row: InfraRow): Stake => ({
  id: row.id,
  patrickName: row.squadron as Patrick,
  versionNumber: row.version_number ?? STAKE_CONSTANTS.BASE_VERSION_NUMBER,
});
