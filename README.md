<p align="center">
    <a href="https://croct.com">
        <img src="https://cdn.croct.io/brand/logo/repo-icon-green.svg" alt="Croct" height="80" />
    </a>
    <br />
    <strong>Plug Next</strong>
    <br />
    The official Croct SDK for Next.js applications.
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@croct/plug-next"><img alt="Version" src="https://img.shields.io/npm/v/@croct/plug-next"/></a>
    <a href="https://github.com/croct-tech/plug-next/actions?query=workflow%3AValidations"><img alt="Build" src="https://github.com/croct-tech/plug-next/workflows/Validations/badge.svg"/></a>
    <a href="https://codeclimate.com/repos/60665953e0608a018c001907/maintainability"><img alt="Maintainability" src="https://api.codeclimate.com/v1/badges/24f7d3e788ed2c66f2ab/maintainability"/></a>
    <a href="https://codeclimate.com/repos/60665953e0608a018c001907/test_coverage"><img alt="Coverage" src="https://api.codeclimate.com/v1/badges/24f7d3e788ed2c66f2ab/test_coverage"/></a>
    <br />
    <br />
    <a href="https://github.com/croct-tech/plug-next/releases">📦 Releases</a>
        ·
    <a href="https://github.com/croct-tech/plug-next/issues/new?labels=bug&template=bug-report.md">🐞 Report Bug</a>
        ·
    <a href="https://github.com/croct-tech/plug-next/issues/new?labels=enhancement&template=feature-request.md">✨ Request Feature</a>
</p>

## Introduction

The Next.js Plug library provides components and utilities for personalizing applications in real-time that are easy for your
marketing team to scale and maintain.


## Getting Started

The following steps will walk you through installing the library and integrating it into your Next.js application.

### Installation

The recommended way to install the library is via [NPM](https://npmjs.com).

Run the following command to add the client as a dependency to your project and then install it:

```sh
npm install @croct/plug-next
```

### Configuration

Before you can start using the library, you need to  set the environment variables and configure a middleware to 
populate the request scope with the client context.

#### Middleware

The configuration of the middleware slightly varies depending on whether you already have a middleware in your application or not.

##### New middleware

If your application does not already have middleware, create a new one in the root of your project and add the following code:

```ts
export {config, middleware} from '@croct/plug-next/middleware';
```

##### Existing middleware

Suppose you already have a middleware in your application like the following example:

```ts
import {NextResponse, NextRequest} from 'next/server';

export const config = {
    matcher: ['/old'],
}

export function middleware(request: NextRequest): NextResponse|void {
    return NextResponse.rewrite(new URL('/new', request.url))
}
```

For these cases, the library provides a higher-order function to wrap your existing middleware:

```ts
import {withCroct} from '@croct/plug-next/middleware';

function redirect(request: NextRequest): NextResponse|void {
    if (request.nextUrl.pathname.startsWith('/old')) {
        return NextResponse.rewrite(new URL('/new', request.url))
    }
}

export {config} from '@croct/plug-next/middleware';

export const middleware = withCroct(redirect);
```

Note that the middleware must be run for all routes where you want to personalize content, 
which usually means all page routes except for static assets. If you are using a [router matcher](https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher),
be sure to modify it to run the middleware for all personalized routes, 
which usually means moving the logic into your custom matcher, as shown in the examples above.

Another important point is that if your middleware calls `NextResponse.next()`, you must ensure that headers are forwarded to the next middleware,
otherwise the client context will not be available in the request scope.

For example, suppose you have a middleware that logs the request headers:

```ts
import {NextResponse, NextRequest} from 'next/server';

function middleware(request: NextRequest): NextResponse {
    console.log(request.headers.get('user-agent'));

    return NextResponse.next();
}
```

Here is how you can adjust it to forward the headers:

```ts
import {NextResponse, NextRequest} from 'next/server';

function logHeaders(request: NextRequest): NextResponse {
    console.log(request.headers.get('user-agent'));

    return NextResponse.next({
        headers: request.headers,
    });
}

export {config} from '@croct/plug-next/middleware';

export const middleware = withCroct(logHeaders);
```

#### Environment variables

Create or update the `.env.local` file in the root of your project and add the following environment variables:

```dotenv
CROCT_API_KEY=<API_KEY>
NEXT_PUBLIC_CROCT_APP_ID=<APP_ID>
```

You can find your API Key and Application ID in the Croct dashboard under Workspaces > Applications > Setup.
The API key is a secret key that should be kept confidential and never exposed to the client side. To create a new API key
go to Workspaces > Applications > API Keys.

### Initialization

You connect Croct to your application with the `<CroctProvider />` component. The `<CroctProvider />` uses a regular React's
`<Context.Provider />` to wrap your React app and make the SDK available anywhere in your component tree.

We suggest putting the `<CroctProvider />` somewhere high in your app, above any component that might be personalized,
ideally in the top-level `<App/>` component.

```tsx
import {render} from 'react-dom';
import {CroctProvider} from '@croct/plug-next/CroctProvider';

function App() {
    return (
        <CroctProvider>
            <div>
                <h1>My first personalized app 🚀</h1>
            </div>
        </CroctProvider>
    );
}

render(<App/>, document.getElementById('root'));
```

### Fetching content

To fetch personalized content, you can use the `fetchContent` function as shown in the example below:

```tsx
import React, {Fragment, ReactElement} from 'react';
import {fetchContent} from '@croct/plug-next/server';

export default async function Page(): Promise<ReactElement> {
    const content = await fetchContent('slot-id');

    return (
        // Render the content
    );
}
```

### Evaluating queries

You can use the `evaluate` function or the `cql` template literal tag to evaluate queries.

Both the `cql` tag and the evaluate function are similar in functionality. The main difference 
between them is that the `cql` tag automatically handles query interpolation for you, 
but it does not support specifying options. On the other hand, the evaluate function allows you to 
specify options, but you must handle query interpolation manually. So if you don't need to specify 
options or interpolation, you can use them interchangeably.

Here is an example of using the evaluate function:

```tsx
import {ReactElement} from 'react';
import {evaluate} from '@croct/plug-next/server';

export default async function Example(): Promise<ReactElement> {
    const isNewYork: boolean = await evaluate("location's city is 'New York'');

    return (/* Render the content */);
}
```

And here is an example of using the `cql` template literal tag:

```tsx
import {ReactElement} from 'react';
import {cql} from '@croct/plug-next/server';

export default async function Example(): Promise<ReactElement> {
    const cities = ['New York', 'Los Angeles', 'Chicago'];
    const isTargetCity: boolean = await cql`location's city is in ${cities}`; 

    return (/* Render the content */);
}
```

## Support

If this documentation has not answered all your questions, don't worry.
Here are some alternative ways to get help from the Croct community.

### Stack Overflow

Someone else from the community may have already asked a similar question or may be able to help with your problem.

The Croct team will also monitor posts with the "croct" tag. If there aren't any existing questions that help,
please [ask a new one](https://stackoverflow.com/questions/ask?tags=croct%20plug-next%20react).

### GitHub

If you have what looks like a bug, or you would like to make a feature request, please
[open a new issue on GitHub](https://github.com/croct-tech/plug-next/issues/new/choose).

Before you file an issue, a good practice is to search for issues to see whether others have the same or similar
problems.
If you are unable to find an open issue addressing the problem, then feel free to open a new one.

### Slack Channel

Many people from the Croct community hang out on the Croct Slack Group.
Feel free to [join us and start a conversation](https://croct.link/community).

## License

This project is released under the [MIT License](LICENSE).
