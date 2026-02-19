import type {NextRequest, NextResponse} from 'next/server';
import {resolvePreferredLocale} from '@/config/context';
import type {RouteContext} from '@/headers';
import {getPreferredLocale} from '@/server/getPreferredLocale';

jest.mock(
    '@/config/context',
    () => ({
        __esModule: true,
        resolvePreferredLocale: jest.fn(),
    }),
);

describe('getPreferredLocale', () => {
    it('should return the preferred locale', async () => {
        jest.mocked(resolvePreferredLocale).mockResolvedValue('en');

        const route: RouteContext = {
            req: {} as NextRequest,
            res: {} as NextResponse,
        };

        await expect(getPreferredLocale(route)).resolves.toBe('en');

        expect(resolvePreferredLocale).toHaveBeenCalledWith(route);
    });

    it('should rethrow dynamic server errors', async () => {
        const error = new class DynamicServerError extends Error {
            public readonly digest = 'DYNAMIC_SERVER_USAGE';

            public constructor() {
                super('cause');

                Object.setPrototypeOf(this, new.target.prototype);
            }
        }();

        jest.mocked(resolvePreferredLocale).mockImplementation(() => {
            throw error;
        });

        await expect(getPreferredLocale()).rejects.toBe(error);
    });

    it('should report an error if the route context is missing', async () => {
        jest.mocked(resolvePreferredLocale).mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        await expect(getPreferredLocale()).rejects.toThrow(
            'Error resolving request context: next/headers requires app router. '
            + 'This error typically occurs when getPreferredLocale() is called outside of app routes without '
            + 'specifying the `route` option. '
            + 'For help, see: https://croct.help/sdk/nextjs/missing-route-context',
        );
    });

    it('should report unexpected errors resolving the context', async () => {
        const error = new Error('unexpected error');

        jest.mocked(resolvePreferredLocale).mockImplementation(() => {
            throw error;
        });

        const route: RouteContext = {
            req: {} as NextRequest,
            res: {} as NextResponse,
        };

        await expect(getPreferredLocale(route)).rejects.toBe(error);
    });

    it('should return an empty string if the preferred locale is not defined', async () => {
        jest.mocked(resolvePreferredLocale).mockResolvedValue(null);

        const route: RouteContext = {
            req: {} as NextRequest,
            res: {} as NextResponse,
        };

        await expect(getPreferredLocale(route)).resolves.toBe('');
    });
});
