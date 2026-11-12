import request from 'supertest';
import { createApp } from '../src/app';
import { AppContainer } from '../src/app.container';
import { AppLogger } from '../src/utils/logger.util';
import { STATIONS } from 'constants/app.constants';

const createAppLogger = (): AppLogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const responseLike = (value: unknown): value is { status: (code: number) => { json: (body: unknown) => void } } =>
  typeof (value as { status?: unknown } | null)?.status === 'function';

const createControllerMock = () =>
  new Proxy(
    {},
    {
      get: () =>
        (...args: unknown[]) => {
          if (responseLike(args[1])) {
            args[1].status(200).json({ ok: true });
          }
          return () => undefined;
        },
    }
  );

const createContainerMock = (station: (typeof STATIONS)[keyof typeof STATIONS] = STATIONS.AIR) =>
  ({
    env: { STATION: station },
    logger: createAppLogger(),
    databaseClient: {
      ping: jest.fn().mockResolvedValue(true),
    },
    missionController: createControllerMock(),
    healthController: createControllerMock(),
    entityCreatorController: createControllerMock(),
    entityUpdaterController: createControllerMock(),
    entityDeleterController: createControllerMock(),
    entityRetrieverController: createControllerMock(),
    defaultNamesController: createControllerMock(),
    stakeController: createControllerMock(),
  } as unknown as AppContainer);

describe('createApp', () => {
  it('sets the default helmet security headers on responses', async () => {
    const app = createApp(createContainerMock());

    const response = await request(app).get('/healthz');

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-dns-prefetch-control']).toBe('off');
    expect(response.headers['x-download-options']).toBe('noopen');
    expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-xss-protection']).toBe('0');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('does not send a content-security-policy header so the docs UI stays usable', async () => {
    const app = createApp(createContainerMock());

    const response = await request(app).get('/healthz');

    expect(response.headers['content-security-policy']).toBeUndefined();
  });
});