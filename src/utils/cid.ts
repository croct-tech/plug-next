import {v4 as uuidv4} from 'uuid';
import {headers as getHeaders} from 'next/headers';
import {Header} from './http';

export function generateCid(): string {
    return uuidv4().replace(/-/g, '');
}

export function getCid(): string {
    const headers = getHeaders();
    const clientId = headers.get(Header.CLIENT_ID);

    if (clientId === null || clientId === '') {
        throw new Error('Client ID is not set. Did you forget to use the withCroct() middleware?');
    }

    return clientId;
}
