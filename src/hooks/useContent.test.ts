import {useContent as useContentMock} from '@croct/plug-react';
import {type NextRouter, useRouter} from 'next/router';
import {useContent, UseContentOptions} from '@/hooks/useContent';

jest.mock(
    '@croct/plug-react',
    () => ({
        useContent: jest.fn(),
    }),
);

jest.mock(
    'next/router',
    () => ({
        useRouter: jest.fn(() => ({locale: undefined})),
    }),
);

describe('useContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE;
    });

    it('should forward the call to useContent', () => {
        const content = {content: 'content'};

        jest.mocked(useContentMock).mockReturnValue(content);

        const options: UseContentOptions<any, any> = {preferredLocale: 'en'};

        expect(useContent('id', options)).toBe(content);

        expect(useContentMock).toHaveBeenCalledWith('id', options);
    });

    it('should use the locale from the router', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE = 'pt';

        jest.mocked(useContentMock).mockReturnValue({
            content: {},
        });

        jest.mocked(useRouter).mockReturnValue({locale: 'en'} as NextRouter);

        useContent('id');

        expect(useContentMock).toHaveBeenCalledWith('id', {preferredLocale: 'en'});
    });

    it('should use the default preferred locale', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE = 'en';

        jest.mocked(useContentMock).mockReturnValue({
            content: {},
        });

        jest.mocked(useRouter).mockReturnValue({locale: ''} as NextRouter);

        useContent('id');

        expect(useContentMock).toHaveBeenCalledWith('id', {preferredLocale: 'en'});
    });

    it('should not forward undefined locales', () => {
        jest.mocked(useContentMock).mockReturnValue({
            content: {},
        });

        jest.mocked(useRouter).mockReturnValue({locale: ''} as NextRouter);

        useContent('id', {
            preferredLocale: undefined,
        });

        const calls = jest.mocked(useContentMock).mock.calls[0][1];

        expect(calls).toStrictEqual({});
    });

    it('should ignore empty locale', () => {
        jest.mocked(useContentMock).mockReturnValue({
            content: {},
        });

        jest.mocked(useRouter).mockReturnValue({locale: ''} as NextRouter);

        useContent('id');

        expect(useContentMock).toHaveBeenCalledWith('id', {});

        const calls = jest.mocked(useContentMock).mock.calls[0][1];

        expect(calls).toStrictEqual({});
    });

    it('should ignore router errors', () => {
        jest.mocked(useContentMock).mockReturnValue({
            content: {},
        });

        jest.mocked(useRouter).mockImplementation(() => {
            throw new Error();
        });

        useContent('id');

        expect(useContentMock).toHaveBeenCalledWith('id', {});
    });

    it('should not override the specified locale', () => {
        jest.mocked(useContentMock).mockReturnValue({
            content: {},
        });

        jest.mocked(useRouter).mockReturnValue({locale: 'en'} as NextRouter);

        const options: UseContentOptions<any, any> = {preferredLocale: 'de'};

        useContent('id', options);

        expect(useContentMock).toHaveBeenCalledWith('id', options);
    });
});
