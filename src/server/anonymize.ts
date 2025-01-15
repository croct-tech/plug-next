import {getUserTokenCookieOptions} from '@/config/cookie';
import {issueToken} from '@/config/security';
import {CookieAccessor, getCookies, RouteContext} from '@/headers';

export async function anonymize(context?: RouteContext): Promise<void> {
    let cookies: CookieAccessor;

    try {
        cookies = await getCookies(context);
    } catch {
        throw new Error(
            'anonymize() requires specifying the `route` parameter outside app routes. '
            + 'For help, see: https://croct.help/sdk/nextjs/missing-route-context',
        );
    }

    const token = await issueToken();
    const cookieOptions = getUserTokenCookieOptions();

    cookies.set(cookieOptions.name, token.toString(), {
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        domain: cookieOptions.domain,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
    });
}
