import {cookies} from 'next/headers';
import {issueToken} from '@/config/security';
import {getUserTokenCookieOptions} from '@/config/cookie';

export async function identify(userId: string): Promise<void> {
    const token = await issueToken(userId);
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
