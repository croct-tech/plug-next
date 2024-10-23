import {ApiKey} from '@croct/sdk/apiKey';
import {Token} from '@croct/sdk/token';
import {randomUUID} from 'crypto';
import {getAppId} from '@/config/appId';

export function getApiKey(): ApiKey {
    const apiKey = process.env.CROCT_API_KEY;

    if (apiKey === undefined) {
        throw new Error(
            'Croct\'s API key is missing. '
          + 'Did you forget to set the `CROCT_API_KEY` environment variable? '
          + 'For help, see: https://croct.help/sdk/nextjs/missing-environment-variable',
        );
    }

    try {
        return ApiKey.parse(apiKey);
    } catch {
        throw new Error('Croct\'s API key is invalid. Please check the `CROCT_API_KEY` environment variable.');
    }
}

export function getAuthenticationKey(): ApiKey {
    const apiKey = getApiKey();

    if (!apiKey.hasPrivateKey()) {
        throw new Error(
            'Croct\'s API key does not have a private key. '
            + 'Please generate an API key with authenticate permissions and update '
            + 'the `CROCT_API_KEY` environment variable.',
        );
    }

    return apiKey;
}

export function isUserTokenAuthenticationEnabled(): boolean {
    return process.env.CROCT_API_KEY !== undefined
        && process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION !== 'true';
}

export function getTokenDuration(): number {
    const duration = process.env.CROCT_TOKEN_DURATION;

    if (duration === undefined) {
        return 24 * 60 * 60;
    }

    const parsedDuration = Number.parseInt(duration, 10);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(
            'The token duration must be a positive integer. '
          + 'Please check the `CROCT_TOKEN_DURATION` environment variable.',
        );
    }

    return parsedDuration;
}

export function issueToken(userId: string|null = null): Promise<Token> {
    const token = Token.issue(getAppId(), userId)
        .withDuration(getTokenDuration());

    if (isUserTokenAuthenticationEnabled()) {
        return token.withTokenId(randomUUID())
            .signedWith(getAuthenticationKey());
    }

    return Promise.resolve(token);
}
