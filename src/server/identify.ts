import {cookies} from 'next/headers';
import {Token} from '@croct/sdk/token';
import {v4 as uuid} from 'uuid';
import {getAppId} from '@/config/appId';
import {getAuthenticationKey, isTokenAuthenticationEnabled} from '@/config/security';
import {getUserTokenCookieOptions} from '@/config/cookie';

export async function identify(userId: string): Promise<void> {
    const token = isTokenAuthenticationEnabled()
        ? await Token.issue(getAppId(), userId)
            .withTokenId(uuid())
            .signedWith(getAuthenticationKey())
        : Token.issue(getAppId(), userId);

    const jar = cookies();
    const cookieOptions = getUserTokenCookieOptions();

    jar.set({
        name: cookieOptions.name,
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        domain: cookieOptions.domain,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        value: token.toString(),
    });
}
