import {cookies} from 'next/headers';
import {Token} from '@croct/sdk/token';
import {v4 as uuid} from 'uuid';
import {getUserTokenCookieOptions} from '@/config/cookie';
import {getAuthenticationKey, isUserTokenAuthenticationEnabled} from '@/config/security';
import {getAppId} from '@/config/appId';

export async function anonymize(): Promise<void> {
    const token = isUserTokenAuthenticationEnabled()
        ? await Token.issue(getAppId())
            .withTokenId(uuid())
            .signedWith(getAuthenticationKey())
        : Token.issue(getAppId());

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
