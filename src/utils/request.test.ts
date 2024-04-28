import {getRequestContext, RequestContext} from '@/utils/request';
import {Header} from '@/utils/http';

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
