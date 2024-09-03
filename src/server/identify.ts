import {issueToken} from '@/config/security';
import {getUserTokenCookieOptions} from '@/config/cookie';
import {getCookies, NextRequestContext, CookieAccessor} from '@/headers';

export async function identify(userId: string, context?: NextRequestContext): Promise<void> {
    let cookies: CookieAccessor;

    try {
        cookies = getCookies(context);
    } catch {
        throw new Error(
            'The identify() function requires a server-side context outside app routes. '
            + 'For help, see: https://croct.help/sdk/nextjs/identify-missing-context',
        );
    }

    const token = await issueToken(userId);
    const cookieOptions = getUserTokenCookieOptions();

    cookies.set(cookieOptions.name, token.toString(), {
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        domain: cookieOptions.domain,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
    });
}
