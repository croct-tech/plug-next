import {formatCause} from '@croct/sdk/error';
import {resolvePreferredLocale} from '@/config/context';
import {RouteContext} from '@/headers';
import {isDynamicServerError} from '@/errors';

export async function getPreferredLocale(route?: RouteContext): Promise<string> {
    try {
        return await resolvePreferredLocale(route) ?? '';
    } catch (error) {
        if (isDynamicServerError(error) || route !== undefined) {
            return Promise.reject(error);
        }

        return Promise.reject(
            new Error(
                `Error resolving request context: ${formatCause(error)}. `
                + 'This error typically occurs when getPreferredLocale() is called outside of app routes '
                + 'without specifying the `route` option. '
                + 'For help, see: https://croct.help/sdk/nextjs/missing-route-context',
            ),
        );
    }
}
