import {AsyncLocalStorage} from 'node:async_hooks';
import type {IncomingMessage} from 'node:http';
import {createServer, get} from 'node:http';
import type {AddressInfo} from 'node:net';
import {startTiming, trackResponse} from '@/serverTiming';

describe('serverTiming', () => {
    const storageKey = Symbol.for('@croct/plug-next/server-timing');

    beforeEach(() => {
        // Match Next's bootstrap without changing the project's Jest environment.
        Object.defineProperty(globalThis, 'AsyncLocalStorage', {value: AsyncLocalStorage, configurable: true});
    });

    afterEach(() => {
        delete process.env.CROCT_SERVER_TIMING;
        Reflect.deleteProperty(globalThis, storageKey);
        Reflect.deleteProperty(globalThis, 'AsyncLocalStorage');
    });

    it('should not track responses when disabled', () => {
        expect(trackResponse()).toBeNull();
        expect(Reflect.has(globalThis, storageKey)).toBe(false);
        expect(startTiming('Croct evaluate')).toBeUndefined();
    });

    it('should track responses only once', () => {
        process.env.CROCT_SERVER_TIMING = 'true';

        const storage = trackResponse();

        expect(storage).toBeInstanceOf(AsyncLocalStorage);
        expect(trackResponse()).toBe(storage);
    });

    it('should not time calls where the response cannot be tracked', () => {
        process.env.CROCT_SERVER_TIMING = 'true';

        Reflect.deleteProperty(globalThis, 'AsyncLocalStorage');

        expect(trackResponse()).toBeNull();
        expect(startTiming('Croct evaluate')).toBeUndefined();
    });

    it('should report timings as a header until the response starts and as a trailer afterwards', async () => {
        process.env.CROCT_SERVER_TIMING = 'true';

        trackResponse();

        const server = createServer(async (_, response) => {
            await Promise.resolve().finally(startTiming('Croct fetch home-hero@1'));

            response.write('shell');

            await Promise.reject(new Error('timeout'))
                .finally(startTiming('Croct "evaluate",\r\n'))
                .catch(() => {});

            response.end();
        });

        await new Promise<void>(resolve => {
            server.listen(0, '127.0.0.1', resolve);
        });

        const response = await new Promise<IncomingMessage>((resolve, reject) => {
            get({port: (server.address() as AddressInfo).port, host: '127.0.0.1', agent: false}, message => {
                message.resume().on('end', () => resolve(message));
            }).on('error', reject);
        });

        server.close();

        expect(response.headers['server-timing']).toMatch(/^croct;desc="Croct fetch home-hero@1";dur=\d+\.\d$/);
        expect(response.trailers['server-timing']).toMatch(/^croct;desc="Croct evaluate";dur=\d+\.\d$/);
    });
});
