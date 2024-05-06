import {ApiKey} from '@croct/sdk/apiKey';

export function getApiKey(): ApiKey {
    const apiKey = process.env.CROCT_API_KEY;

    if (apiKey === undefined) {
        throw new Error('Croct\'s API key is missing. Did you forget to set the CROCT_API_KEY environment variable?');
    }

    try {
        return ApiKey.parse(apiKey);
    } catch {
        throw new Error('Croct\'s API key is invalid. Please check the CROCT_API_KEY environment variable.');
    }
}

export function getAuthenticationKey(): ApiKey {
    const apiKey = getApiKey();

    if (!apiKey.hasPrivateKey()) {
        throw new Error(
            'Croct\'s API key does not have a private key. '
            + 'Please generate an API key with authenticate permissions and update '
            + 'the CROCT_API_KEY environment variable.',
        );
    }

    return apiKey;
}

export function isUserTokenAuthenticationEnabled(): boolean {
    return process.env.CROCT_API_KEY !== undefined
        && process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION !== 'true';
}
