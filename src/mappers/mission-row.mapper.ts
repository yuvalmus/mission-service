import { Mission, MissionBase, MISSION_CONSTANTS, SonicMissionProperties } from 'models/mission.models';

export interface MissionRow {
  id: string;
  name: string;
  version_number: number;
  comment: string | null;
  created_by: string | null;
  mission_type: string | null;
  password: string | null;
  attached_mission_id: number | null;
  sonic_properties: SonicMissionProperties | null;
  date_created: Date;
  last_update_time: Date;
}

export const toMissionBase = (row: MissionRow): MissionBase => ({
  id: row.id,
  timeInfo: { dateCreated: row.date_created, lastUpdateTime: row.last_update_time },
  name: row.name,
  comment: row.comment ?? '',
  createdBy: row.created_by ?? '',
  missionType: row.mission_type ?? '',
  password: row.password ?? '',
  attachedMissionId: row.attached_mission_id ?? undefined,
});

export const toMission = (row: MissionRow): Mission => ({
  ...toMissionBase(row),
  versionNumber: row.version_number ?? MISSION_CONSTANTS.BASE_VERSION_NUMBER,
  sonicProperties: row.sonic_properties ?? undefined,
});

export const toMissionValues = (mission: Mission, nodeName: string): unknown[] => [
  mission.id,
  mission.name,
  mission.versionNumber,
  mission.comment ?? null,
  mission.createdBy ?? null,
  mission.missionType ?? null,
  mission.password ?? null,
  mission.attachedMissionId ?? null,
  mission.sonicProperties ? JSON.stringify(mission.sonicProperties) : null,
  mission.timeInfo?.dateCreated ?? new Date(),
  mission.timeInfo?.lastUpdateTime ?? new Date(),
  nodeName,
];
