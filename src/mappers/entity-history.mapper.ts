import { EntityVersionDto } from 'dtos/sync.dtos';
import { EntityVersionRow } from 'repositories/postgres/history.repository';

export const toEntityVersionDto = (row: EntityVersionRow): EntityVersionDto => ({
  eventId: row.event_id,
  entityId: row.entity_id,
  version: Number(row.version),
  entityType: row.entity_type,
  originNode: row.origin_node,
  changeSeq: Number(row.mission_change_seq),
  lastUpdateTime: row.last_update_time,
  isDeleted: row.is_deleted,
  isCurrent: row.is_current,
  geometry: row.geometry ?? null,
  properties: row.properties,
});
