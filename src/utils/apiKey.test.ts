import {getApiKey} from '@/utils/apiKey';

describe('apiKey', () => {
    beforeEach(() => {
        delete process.env.CROCT_API_KEY;
    });

    it('should return the API key', () => {
        process.env.CROCT_API_KEY = 'my-api-key';

        expect(getApiKey()).toBe(process.env.CROCT_API_KEY);
    });

    it('should throw an error if the API key is not set', () => {
        expect(() => getApiKey())
            .toThrow('The API key is not set. Did you forget export the CROCT_API_KEY environment variable?');
    });
});
