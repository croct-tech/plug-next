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
    });

    it('should forward the call to useContent', () => {
        const content = {content: 'content'};

        jest.mocked(useContentMock).mockReturnValue(content);

        const options: UseContentOptions<any, any> = {preferredLocale: 'en'};

        expect(useContent('id', options)).toBe(content);

        expect(useContentMock).toHaveBeenCalledWith('id', options);
    });

    it('should use the locale from the router', () => {
        jest.mocked(useContentMock).mockReturnValue({});

        jest.mocked(useRouter).mockReturnValue({locale: 'en'} as NextRouter);

        useContent('id');

        expect(useContentMock).toHaveBeenCalledWith('id', {preferredLocale: 'en'});
    });

    it('should ignore empty locale', () => {
        jest.mocked(useContentMock).mockReturnValue({});

        jest.mocked(useRouter).mockReturnValue({locale: ''} as NextRouter);

        useContent('id');

        expect(useContentMock).toHaveBeenCalledWith('id', undefined);
    });

    it('should not override the specified locale', () => {
        jest.mocked(useContentMock).mockReturnValue({});

        jest.mocked(useRouter).mockReturnValue({locale: 'en'} as NextRouter);

        const options: UseContentOptions<any, any> = {preferredLocale: 'de'};

        useContent('id', options);

        expect(useContentMock).toHaveBeenCalledWith('id', options);
    });
});
