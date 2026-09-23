import { describeReplicationError } from 'database/postgres/pglogical.setup';

describe('describeReplicationError', () => {
  it('redacts a password carried in a DSN', () => {
    const error = new Error('could not connect: dsn was: host=station-b-postgres port=5432 user=mesh password=mesh_pass');

    const described = describeReplicationError(error);

    expect(described).not.toContain('mesh_pass');
    expect(described).toContain('password=***');
    expect(described).toContain('host=station-b-postgres');
  });

  it('redacts every password when the message repeats the DSN', () => {
    const described = describeReplicationError(new Error('password=first then password=second'));

    expect(described).toBe('password=*** then password=***');
  });

  it('describes a non-Error value without throwing', () => {
    expect(describeReplicationError('peer unreachable password=x')).toBe('peer unreachable password=***');
  });
});
