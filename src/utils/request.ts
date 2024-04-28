import 'server-only';

import {Header} from '@/utils/http';

export type RequestContext = {
    clientId: string,
    uri?: string,
    clientAgent?: string,
    referrer?: string,
    clientIp?: string,
    previewToken?: string,
};

export function getRequestContext(headers: Headers): RequestContext {
    const clientId = headers.get(Header.CLIENT_ID);

    if (clientId === null) {
        throw new Error('Croct Client ID is missing. Did you forget to configure the Croct middleware?');
    }

    const context: RequestContext = {
        clientId: clientId,
    };

    const uri = headers.get(Header.REQUEST_URI);

    if (uri !== null) {
        context.uri = uri;
    }

    const userAgent = headers.get(Header.USER_AGENT);

    if (userAgent !== null) {
        context.clientAgent = userAgent;
    }

    const referrer = headers.get(Header.REFERRER);

    if (referrer !== null) {
        context.referrer = referrer;
    }

    const clientIp = headers.get(Header.CLIENT_IP);

    if (clientIp !== null) {
        context.clientIp = clientIp;
    }

    const previewToken = headers.get(Header.PREVIEW_TOKEN);

    if (previewToken !== null) {
        context.previewToken = previewToken;
    }

    return context;
}
