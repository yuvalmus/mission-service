import { generateOpenApiDocument } from 'docs/openapi.docs';

const HTTP_METHODS = ['get', 'post', 'put', 'delete'] as const;

interface Operation {
  path: string;
  method: string;
  operationId?: string;
}

describe('openapi.docs', () => {
  const doc = generateOpenApiDocument();
  const components = doc.components as { schemas: Record<string, any> };

  const resolveRef = (node: any): any =>
    node && typeof node === 'object' && node.$ref
      ? components.schemas[node.$ref.replace('#/components/schemas/', '')]
      : node;

  const effectiveRequired = (schema: any): string[] => {
    const required: string[] = [...(schema?.required ?? [])];
    (schema?.allOf ?? []).forEach((member: any) => {
      effectiveRequired(resolveRef(member)).forEach(field => {
        if (!required.includes(field)) required.push(field);
      });
    });
    return required;
  };

  it('keeps timeInfo optional in BasicEntityGeneralInfo but required in GeneralEntityInfo', () => {
    expect(effectiveRequired(components.schemas['BasicEntityGeneralInfo'])).not.toContain('timeInfo');
    expect(effectiveRequired(components.schemas['GeneralEntityInfo'])).toContain('timeInfo');
  });

  const operations = (
    Object.entries(
      doc.paths as Record<string, Partial<Record<(typeof HTTP_METHODS)[number], { operationId?: string }>>>
    ) as [string, Record<string, { operationId?: string } | undefined>][]
  )
    .flatMap(([path, methods]) =>
      HTTP_METHODS.flatMap(method => {
        const operation = methods[method];
        return operation ? [{ path, method, operationId: operation.operationId }] : [];
      })
    )
    .filter(Boolean) as Operation[];

  it('gives every operation an operationId', () => {
    const missing = operations.filter(operation => !operation.operationId);
    expect(missing.map(operation => `${operation.method.toUpperCase()} ${operation.path}`)).toEqual([]);
  });

  it('uses a unique operationId for every operation', () => {
    const ids = operations.map(operation => operation.operationId).filter(Boolean);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('names entity operations per the getX/createX/deleteX scheme', () => {
    expect((doc.paths as Record<string, unknown>)['/entities/circle/{id}']).toMatchObject({
      get: { operationId: 'getCircle' }
    });
    expect((doc.paths as Record<string, unknown>)['/entities/messi/{id}']).toMatchObject({
      get: { operationId: 'getMessi' }
    });
    expect((doc.paths as Record<string, unknown>)['/entities/navigationWayPoint/{id}']).toMatchObject({
      get: { operationId: 'getNavigationWayPoint' }
    });
    expect((doc.paths as Record<string, unknown>)['/create/circle']).toMatchObject({
      post: { operationId: 'createCircle' }
    });
    expect((doc.paths as Record<string, unknown>)['/create/navigationWayPoint']).toMatchObject({
      post: { operationId: 'createNavigationWayPoint' }
    });
    expect((doc.paths as Record<string, unknown>)['/createStake/circle']).toMatchObject({
      post: { operationId: 'createCircleStake' }
    });
    expect((doc.paths as Record<string, unknown>)['/update/circle']).toMatchObject({
      put: { operationId: 'updateCircle' }
    });
    expect((doc.paths as Record<string, unknown>)['/delete/circle/{mission}/{id}']).toMatchObject({
      delete: { operationId: 'deleteCircle' }
    });
    expect((doc.paths as Record<string, unknown>)['/names/circle/{missionId}/{amount}']).toMatchObject({
      get: { operationId: 'namesCircle' }
    });
  });
});