/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
import { readFile } from 'fs/promises';
import assert from 'assert';
import { resolve } from 'path';
import { Request } from '@adobe/fetch';
import { main } from '../src/index.js';
import { Nock, uncompress } from './utils.js';

function reqUrl(path = '/', init = {}) {
  const url = new URL('https://localhost');
  url.searchParams.append('org', 'owner');
  url.searchParams.append('site', 'repo');
  url.searchParams.append('sourceUrl', `https://www.example.com${path}`);
  url.searchParams.append('contentBusId', 'foo-id');
  return new Request(url.href, init);
}

const DUMMY_ENV = {
  MEDIAHANDLER_NOCACHHE: true,
  AWS_REGION: 'dummy',
  AWS_ACCESS_KEY_ID: 'dummy',
  AWS_SECRET_ACCESS_KEY: 'dummy',
  CLOUDFLARE_ACCOUNT_ID: 'dummy',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'dummy',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'dummy',
};

describe('Index Tests', () => {
  let nock;
  beforeEach(() => {
    nock = new Nock().env();
    Object.assign(process.env, {
      AWS_S3_REGION: 'us-east-1',
      AWS_S3_ACCESS_KEY_ID: 'dummy',
      AWS_S3_SECRET_ACCESS_KEY: 'dummy',
    });
  });

  afterEach(() => {
    nock.done();
  });

  for (const param of ['sourceUrl', 'site', 'org', 'contentBusId']) {
    it(`returns 400 for missing ${param}`, async () => {
      const url = new URL('https://localhost');
      url.searchParams.append('sourceUrl', 'https://www.example.com/foo.html');
      url.searchParams.append('org', 'org');
      url.searchParams.append('site', 'site');
      url.searchParams.append('contentBusId', 'contentBusId');
      url.searchParams.delete(param);
      const result = await main(new Request(url.href), { log: console });
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.headers.plain(), {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/plain; charset=utf-8',
        'x-error': 'sourceUrl, site, org and contentBusID parameters are required.',
      });
    });
  }

  describe('image upload', () => {
    const testImagePath = resolve(__testdir, 'fixtures', '300.png');

    /**
     * The following test cases use the images.html fixture and allow the upload of all images.
     */
    [
      '*', // allow all
      'images.dummy.com', // allow images.dummy.com
      '*.dummy.com', // allow dummy.com subdomains
      'self https://images.dummy.com', // allow images.dummy.com with protocol, self explicitly
      'https://images.dummy.com/200', // allow images.dummy.com path ignored
    ].forEach((imgSrcPolicy) => {
      it(`uploads images to media-bus with to img-src policy '${imgSrcPolicy}'`, async () => {
        const headers = { authorization: 'Basic am9objpkb2U=' };
        const reqheaders = { ...headers };
        nock('https://www.example.com', { reqheaders })
          .get('/blog/article')
          .replyWithFile(200, resolve(__testdir, 'fixtures', 'images.html'), {
            'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
            'x-html2md-img-src': imgSrcPolicy,
          })
          .get('/missing.png')
          .reply(404)
          .get('/absolute.png')
          .basicAuth({ user: 'john', pass: 'doe' })
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          })
          .get('/meta-image.png')
          .basicAuth({ user: 'john', pass: 'doe' })
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          })
          .get('/blog/relative.png')
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          })
          .get('/adobe/assets/urn:aaid:aem:abcd')
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          });
        nock('https://images.dummy.com', { reqheaders })
          .get('/300.png')
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          });
        nock('https://helix-media-bus.s3.us-east-1.amazonaws.com')
          .head('/foo-id/1c2e2c6c049ccf4b583431e14919687f3a39cc227')
          .times(5)
          .reply(404)
          .put('/foo-id/1c2e2c6c049ccf4b583431e14919687f3a39cc227?x-id=PutObject')
          .times(5)
          .reply(201);

        const expected = await readFile(resolve(__testdir, 'fixtures', 'images.md'), 'utf-8');
        const result = await main(reqUrl('/blog/article', { headers }), { log: console, env: DUMMY_ENV });
        assert.strictEqual(result.status, 200);

        const uncompressed = await uncompress(result);
        assert.strictEqual(uncompressed, expected.trim());
        assert.deepStrictEqual(result.headers.plain(), {
          'cache-control': 'no-store, private, must-revalidate',
          'content-encoding': 'gzip',
          'content-length': '837',
          'content-type': 'text/markdown; charset=utf-8',
          'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
          'x-source-location': 'https://www.example.com/blog/article',
        });
      });
    });

    /**
     * The following test cases use the images.html fixture but do not allow the upload of the
     * https://images.dummy.com/300.png image.
     */
    [
      '', // allow nothing but self
      'self', // allow nothing but self
      'assets.dummy.com', // unallowed subdomain
      '*dummy.com', // invalid subdomain
    ].forEach((imgSrcPolicy) => {
      it(`does upload images to media-bus sending no auth with img-src policy '${imgSrcPolicy}'`, async () => {
        const headers = { authorization: 'Basic am9objpkb2U=' };
        nock('https://www.example.com', { reqheaders: { ...headers } })
          .get('/blog/article')
          .replyWithFile(200, resolve(__testdir, 'fixtures', 'images.html'), {
            'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
            'x-html2md-img-src': imgSrcPolicy,
          })
          .get('/missing.png')
          .reply(404)
          .get('/absolute.png')
          .basicAuth({ user: 'john', pass: 'doe' })
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          })
          .get('/meta-image.png')
          .basicAuth({ user: 'john', pass: 'doe' })
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          })
          .get('/blog/relative.png')
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          })
          .get('/adobe/assets/urn:aaid:aem:abcd')
          .basicAuth({ user: 'john', pass: 'doe' })
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          });
        nock('https://images.dummy.com', { badheaders: ['authorization'] })
          .get('/300.png')
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          });
        nock('https://helix-media-bus.s3.us-east-1.amazonaws.com')
          .head('/foo-id/1c2e2c6c049ccf4b583431e14919687f3a39cc227')
          .times(5)
          .reply(404)
          .put('/foo-id/1c2e2c6c049ccf4b583431e14919687f3a39cc227?x-id=PutObject')
          .times(5)
          .reply(201);

        const expected = await readFile(resolve(__testdir, 'fixtures', 'images.md'), 'utf-8');
        const result = await main(reqUrl('/blog/article', { headers }), { log: console, env: DUMMY_ENV });
        assert.strictEqual(result.status, 200);

        const uncompressed = await uncompress(result);
        assert.strictEqual(uncompressed, expected.trim());
        assert.deepStrictEqual(result.headers.plain(), {
          'cache-control': 'no-store, private, must-revalidate',
          'content-encoding': 'gzip',
          'content-length': '837',
          'content-type': 'text/markdown; charset=utf-8',
          'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
          'x-source-location': 'https://www.example.com/blog/article',
        });
      });
    });
  });

  it('returns 200 for a simple html', async () => {
    nock('https://www.example.com', {
      reqheaders: {
        authorization: 'Bearer 1234',
        'x-content-source-location': '/content/some-path/index?sig=signature&exp=2024-03-03T10:00:00.000Z',
      },
    })
      .get('/')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'simple.html'), {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });
    const expected = await readFile(resolve(__testdir, 'fixtures', 'simple.md'), 'utf-8');
    const result = await main(
      reqUrl('/', {
        headers: {
          authorization: 'Bearer 1234',
          'x-content-source-location': '/content/some-path/index?sig=signature&exp=2024-03-03T10:00:00.000Z',
        },
      }),
      {
        log: console,
        env: DUMMY_ENV,
      },
    );
    assert.strictEqual(result.status, 200);

    const uncompressed = await uncompress(result);
    assert.strictEqual(uncompressed, expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-encoding': 'gzip',
      'content-length': '157',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com/',
    });
  });

  for (const status of [
    { origin: 400, expected: 400 },
    { origin: 401, expected: 401 },
    { origin: 403, expected: 404 },
    { origin: 404, expected: 404 },
  ]) {
    // eslint-disable-next-line no-loop-func
    it(`returns ${status.origin} for a ${status.expected} response`, async () => {
      nock('https://www.example.com').get('/').reply(status.origin);

      const result = await main(reqUrl('/'), { log: console });
      assert.strictEqual(result.status, status.expected);
      assert.strictEqual(await result.text(), '');
      assert.deepStrictEqual(result.headers.plain(), {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/plain; charset=utf-8',
        'x-error':
          status.expected === 400
            ? 'error fetching resource at https://www.example.com/'
            : 'resource not found: https://www.example.com/',
      });
    });
  }

  it('returns 200 for a simple html (with unspread feature)', async () => {
    nock('https://www.example.com', {
      reqheaders: {
        authorization: 'Bearer 1234',
        'x-content-source-location': '/content/some-path/index?sig=signature&exp=2024-03-03T10:00:00.000Z',
      },
    })
      .get('/')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'unspread.html'), {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });
    const expected = await readFile(resolve(__testdir, 'fixtures', 'unspread.md'), 'utf-8');
    const result = await main(
      new Request('https://example.org/', {
        method: 'POST',
        headers: {
          authorization: 'Bearer 1234',
          'x-content-source-location': '/content/some-path/index?sig=signature&exp=2024-03-03T10:00:00.000Z',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          org: 'owner',
          site: 'repo',
          sourceUrl: 'https://www.example.com/',
          contentBusId: 'foo-id',
          features: {
            unspreadLists: true,
          },
        }),
      }),
      {
        log: console,
        env: DUMMY_ENV,
      },
    );
    assert.strictEqual(result.status, 200);

    const uncompressed = await uncompress(result);
    assert.strictEqual(uncompressed, expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-encoding': 'gzip',
      'content-length': '406',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com/',
    });
  });

  it('returns 400 for bad json-ld', async () => {
    const html = `<html>
<head>
  <script type="application/ld+json">
    {"@context":"http://schema.org",.
  </script>
</head>

<body>
  <main>
    <div>
      <h1>Hello, World.</h1>
    </div>
  </main>
</body>

</html>
`;
    nock('https://www.example.com')
      .get('/')
      .reply(200, html);

    const result = await main(reqUrl('/'), { log: console, env: {} });
    assert.strictEqual(result.status, 400);
    assert.strictEqual(await result.text(), '');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com/: invalid json-ld',
    });
  });

  it('returns 409 for too many different images', async () => {
    let html = '<html><body><main><div>';
    for (let i = 0; i < 201; i += 1) {
      html += `<img src="/image-${i}.png">`;
    }
    html += '</div></main></body>';

    nock('https://www.example.com')
      .get('/')
      .reply(200, html);

    const result = await main(reqUrl('/'), { log: console, env: {} });
    assert.strictEqual(result.status, 409);
    assert.strictEqual(await result.text(), '');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com/: maximum number of images reached: 201 of 200 max.',
    });
  });

  it('honors maxImages limit', async () => {
    nock('https://www.example.com')
      .get(/\/image-\d+\.png/)
      .times(250)
      .replyWithFile(200, resolve(__testdir, 'fixtures', '300.png'), {
        'content-type': 'image/png',
      });

    nock('https://helix-media-bus.s3.us-east-1.amazonaws.com')
      .head('/foo-id/1c2e2c6c049ccf4b583431e14919687f3a39cc227')
      .times(250)
      .reply(404)
      .put('/foo-id/1c2e2c6c049ccf4b583431e14919687f3a39cc227?x-id=PutObject')
      .times(250)
      .reply(201);

    let html = '<html><body><main><div>';
    for (let i = 0; i < 250; i += 1) {
      html += `<img src="/image-${i}.png">`;
    }
    html += '</div></main></body>';

    nock('https://www.example.com')
      .get('/')
      .reply(200, html);

    const result = await main(
      new Request('https://www.example.com/', {
        method: 'POST',
        headers: {
          authorization: 'Bearer 1234',
          'x-content-source-location': '/content/some-path/index?sig=signature&exp=2024-03-03T10:00:00.000Z',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          org: 'owner',
          site: 'repo',
          sourceUrl: 'https://www.example.com/',
          contentBusId: 'foo-id',
          limits: {
            maxImages: 250,
          },
        }),
      }),
      {
        log: console,
        env: DUMMY_ENV,
      },
    );
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-encoding': 'gzip',
      'content-length': '2870',
      'content-type': 'text/markdown; charset=utf-8',
      'x-source-location': 'https://www.example.com/',
    });
  });

  it('return 409 for large image', async () => {
    nock('https://www.example.com')
      .get('/')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'image-large.html'), {})
      .get('/large.png')
      .reply(200, Buffer.alloc(15 * 1025 * 1024), {
        'content-type': 'image/png',
        'content-length': 15 * 1024 * 1240,
      });

    const result = await main(
      new Request('https://www.example.com/', {
        method: 'POST',
        headers: {
          authorization: 'Bearer 1234',
          'x-content-source-location': '/content/some-path/index?sig=signature&exp=2024-03-03T10:00:00.000Z',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          org: 'owner',
          site: 'repo',
          sourceUrl: 'https://www.example.com/',
          contentBusId: 'foo-id',
        }),
      }),
      {
        log: console,
        env: DUMMY_ENV,
      },
    );
    assert.strictEqual(result.status, 409);
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com/: Resource size exceeds allowed limit: 15744000 > 10485760',
    });
  });

  it('honors maxImageSize limit', async () => {
    nock('https://helix-media-bus.s3.us-east-1.amazonaws.com')
      .head('/foo-id/1c662877ed0645d24800fad6eb5c1223895753d90')
      .reply(404)
      .post('/foo-id/1c662877ed0645d24800fad6eb5c1223895753d90?uploads=')
      .reply(201);

    nock('https://www.example.com')
      .get('/')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'image-large.html'), {})
      .get('/large.png')
      .reply(200, Buffer.alloc(15 * 1025 * 1024), {
        'content-type': 'image/png',
        'content-length': 15 * 1024 * 1240,
      });

    const result = await main(
      new Request('https://www.example.com/', {
        method: 'POST',
        headers: {
          authorization: 'Bearer 1234',
          'x-content-source-location': '/content/some-path/index?sig=signature&exp=2024-03-03T10:00:00.000Z',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          org: 'owner',
          site: 'repo',
          sourceUrl: 'https://www.example.com/',
          contentBusId: 'foo-id',
          limits: {
            maxImageSize: 20 * 1024 * 1024, // 20mb
          },
        }),
      }),
      {
        log: console,
        env: DUMMY_ENV,
      },
    );
    const expected = await readFile(resolve(__testdir, 'fixtures', 'image-large.md'), 'utf-8');
    const uncompressed = await uncompress(result);
    assert.strictEqual(result.status, 200);
    assert.strictEqual(uncompressed, expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-encoding': 'gzip',
      'content-length': '345',
      'content-type': 'text/markdown; charset=utf-8',
      'x-source-location': 'https://www.example.com/',
    });
  });

  it('returns 409 for a large html', async () => {
    nock('https://www.example.com')
      .get('/')
      .reply(200, 'x'.repeat(1024 ** 2 + 1));

    const result = await main(reqUrl('/'), { log: console });
    assert.strictEqual(result.status, 409);
    assert.strictEqual(await result.text(), '');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com/: html source larger than 1mb',
    });
  });

  it('returns 502 for a error response', async () => {
    nock('https://www.example.com')
      .get('/')
      .reply(500);

    const result = await main(reqUrl('/'), { log: console });
    assert.strictEqual(result.status, 502);
    assert.strictEqual(await result.text(), '');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com/: 500',
      'x-severity': 'warn',
    });
  });

  it('returns 502 for a fetch error', async () => {
    nock('https://www.example.com')
      .get('/')
      .replyWithError(new Error('boom!'));

    const result = await main(reqUrl('/'), { log: console });
    assert.strictEqual(result.status, 502);
    assert.strictEqual(await result.text(), '');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com/: boom!',
      'x-severity': 'warn',
    });
  });

  it('returns 504 when html fetch times out', async () => {
    nock('https://www.example.com')
      .get('/')
      .delay(100)
      .reply(404);

    const result = await main(reqUrl('/'), { log: console, env: { HTML_FETCH_TIMEOUT: 10 } });
    assert.strictEqual(result.status, 504);
    assert.strictEqual(await result.text(), '');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com/: timeout after 10s',
      'x-severity': 'warn',
    });
  });
});
