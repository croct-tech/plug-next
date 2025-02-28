import {isDynamicServerError} from '@/errors';

describe('errors', () => {
    type TypeGuardScenario = {
        error: any,
        expected: boolean,
    };

    it.each<TypeGuardScenario>([
        {
            error: null,
            expected: false,
        },
        {
            error: undefined,
            expected: false,
        },
        {
            error: {},
            expected: false,
        },
        {
            error: new Error(),
            expected: false,
        },
        {
            error: new class {
                public readonly digest = 'DYNAMIC_SERVER_USAGE';
            }(),
            expected: true,
        },
    ])('should return $expected for $error identifying a DynamicServerError', ({error, expected}) => {
        expect(isDynamicServerError(error)).toBe(expected);
    });
});
