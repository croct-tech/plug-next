import {getDefaultFetchTimeout, getRequestContext, RequestContext} from '@/config/request';
import {Header} from '@/config/http';

jest.mock(
    'server-only',
    () => ({
        __esModule: true,
    }),
);

describe('getRequestContext', () => {
    it('should throw an error when the client ID is missing', () => {
        expect(() => getRequestContext(new Headers()))
            .toThrow('Croct Client ID is missing. Did you forget to configure the Croct middleware?');
    });

    it('should return a full request context', () => {
        const request = {
            clientId: '00000000-0000-0000-0000-000000000000',
            uri: 'http://localhost:3000',
            clientAgent: 'Mozilla/5.0',
            referrer: 'http://referrer.com',
            clientIp: '192.0.0.1',
            previewToken: 'preview-token',
        } satisfies RequestContext;

        const headers = new Headers();

        headers.set(Header.CLIENT_ID, request.clientId);
        headers.set(Header.REQUEST_URI, request.uri);
        headers.set(Header.USER_AGENT, request.clientAgent);
        headers.set(Header.REFERRER, request.referrer);
        headers.set(Header.CLIENT_IP, request.clientIp);
        headers.set(Header.PREVIEW_TOKEN, request.previewToken);

        expect(getRequestContext(headers)).toEqual(request);
    });

    it('should return a partial request context', () => {
        const request = {
            clientId: '00000000-0000-0000-0000-000000000000',
        } satisfies RequestContext;

        const headers = new Headers();

        headers.set(Header.CLIENT_ID, request.clientId);

        expect(getRequestContext(headers)).toEqual(request);
    });
});

describe('getDefaultFetchTimeout', () => {
    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT;
    });

    it('should return undefined when the environment variable is missing', () => {
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT;

        expect(getDefaultFetchTimeout()).toBeUndefined();
    });

    it('should return undefined when the environment variable is empty', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '';

        expect(getDefaultFetchTimeout()).toBeUndefined();
    });

    it('should return the parsed timeout value', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '5000';

        expect(getDefaultFetchTimeout()).toBe(5000);
    });

    it('should fail if the timeout is not a valid integer', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = 'invalid';

        expect(() => getDefaultFetchTimeout())
            .toThrow(
                "The default fetch timeout must be a non-negative integer, got 'invalid'. " +
                'Please check the environment variable NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT.'
            );
    });

    it('should fail if the timeout is not a positive integer', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '-1';

        expect(() => getDefaultFetchTimeout())
            .toThrow(
                "The default fetch timeout must be a non-negative integer, got '-1'. " +
                'Please check the environment variable NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT.'
            );
    });
});
