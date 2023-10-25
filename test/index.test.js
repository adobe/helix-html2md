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
import { Nock } from './utils.js';

function reqUrl(path = '', init = {}) {
  const url = new URL('https://localhost');
  url.searchParams.append('owner', 'owner');
  url.searchParams.append('repo', 'repo');
  url.searchParams.append('path', path);
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

  for (const param of ['path', 'owner', 'repo']) {
    it(`returns 400 for missing ${param}`, async () => {
      const url = new URL('https://localhost');
      url.searchParams.append('path', '/index.html');
      url.searchParams.append('owner', 'owner');
      url.searchParams.append('repo', 'repo');
      url.searchParams.delete(param);
      const result = await main(new Request(url.href), { log: console });
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.headers.plain(), {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/plain; charset=utf-8',
        'x-error': 'path, owner and repo parameters are required.',
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
        nock.fstab();
        nock('https://www.example.com')
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
          });
        nock('https://images.dummy.com')
          .get('/300.png')
          .replyWithFile(200, testImagePath, {
            'content-type': 'image/png',
          });
        nock('https://helix-media-bus.s3.us-east-1.amazonaws.com')
          .head('/49365e2b6b265ccba4bed01f5fa3cbcf6a028e5354d2b647f5eb37be735/1c2e2c6c049ccf4b583431e14919687f3a39cc227')
          .times(4)
          .reply(404)
          .put('/49365e2b6b265ccba4bed01f5fa3cbcf6a028e5354d2b647f5eb37be735/1c2e2c6c049ccf4b583431e14919687f3a39cc227?x-id=PutObject')
          .times(4)
          .reply(201);

        const expected = await readFile(resolve(__testdir, 'fixtures', 'images.md'), 'utf-8');
        const result = await main(reqUrl('/blog/article', { headers: { authorization: 'Basic am9objpkb2U=' } }), { log: console, env: DUMMY_ENV });
        assert.strictEqual(result.status, 200);
        assert.strictEqual((await result.text()).trim(), expected.trim());
        assert.deepStrictEqual(result.headers.plain(), {
          'cache-control': 'no-store, private, must-revalidate',
          'content-length': '695',
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
      it(`does not upload images to media-bus with to img-src policy '${imgSrcPolicy}'`, async () => {
        nock.fstab();
        nock('https://www.example.com')
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
          });
        nock('https://helix-media-bus.s3.us-east-1.amazonaws.com')
          .head('/49365e2b6b265ccba4bed01f5fa3cbcf6a028e5354d2b647f5eb37be735/1c2e2c6c049ccf4b583431e14919687f3a39cc227')
          .times(3)
          .reply(404)
          .put('/49365e2b6b265ccba4bed01f5fa3cbcf6a028e5354d2b647f5eb37be735/1c2e2c6c049ccf4b583431e14919687f3a39cc227?x-id=PutObject')
          .times(3)
          .reply(201);

        const expected = await readFile(resolve(__testdir, 'fixtures', 'images-negative.md'), 'utf-8');
        const result = await main(reqUrl('/blog/article', { headers: { authorization: 'Basic am9objpkb2U=' } }), { log: console, env: DUMMY_ENV });
        assert.strictEqual(result.status, 200);
        assert.strictEqual((await result.text()).trim(), expected.trim());
        assert.deepStrictEqual(result.headers.plain(), {
          'cache-control': 'no-store, private, must-revalidate',
          'content-length': '739',
          'content-type': 'text/markdown; charset=utf-8',
          'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
          'x-source-location': 'https://www.example.com/blog/article',
        });
      });
    });
  });

  it('returns 200 for a simple html via path', async () => {
    nock.fstab();
    nock('https://www.example.com', {
      reqheaders: {
        authorization: 'Bearer 1234',
      },
    })
      .get('/index.html')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'simple.html'), {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });
    const expected = await readFile(resolve(__testdir, 'fixtures', 'simple.md'), 'utf-8');
    const result = await main(reqUrl('/index.html', { headers: { authorization: 'Bearer 1234' } }), { log: console, env: DUMMY_ENV });
    assert.strictEqual(result.status, 200);
    assert.strictEqual((await result.text()).trim(), expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '157',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com/index.html',
    });
  });

  [
    'https://www.example.com/content/mysite',
    'https://www.example.com/content/mysite/',
  ].forEach((mpUrl) => it(`returns 200 for a simple html via path and preserves mountpoint pathname: ${mpUrl}`, async () => {
    nock.fstab(`
mountpoints:
  /:
    url: ${mpUrl}
    type: markup
    suffix: '.semantic.html');
`);
    nock('https://www.example.com', {
      reqheaders: {
        authorization: 'Bearer 1234',
      },
    })
      .get('/content/mysite/index.html')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'simple.html'), {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });
    const expected = await readFile(resolve(__testdir, 'fixtures', 'simple.md'), 'utf-8');
    const result = await main(reqUrl('/index.html', { headers: { authorization: 'Bearer 1234' } }), { log: console, env: DUMMY_ENV });
    assert.strictEqual(result.status, 200);
    assert.strictEqual((await result.text()).trim(), expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '157',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com/content/mysite/index.html',
    });
  }));

  it('returns 200 for deep index page', async () => {
    nock.fstab();
    nock('https://www.example.com', {
      reqheaders: {
        authorization: 'Bearer 1234',
      },
    })
      .get('/blog/')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'simple.html'), {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });
    const expected = await readFile(resolve(__testdir, 'fixtures', 'simple.md'), 'utf-8');

    const url = new URL('https://localhost');
    url.searchParams.append('path', '/blog/');
    url.searchParams.append('owner', 'owner');
    url.searchParams.append('repo', 'repo');
    const req = new Request(url.href, {
      headers: {
        authorization: 'Bearer 1234',
      },
    });

    const result = await main(req, { log: console, env: DUMMY_ENV });
    assert.strictEqual(result.status, 200);
    assert.strictEqual((await result.text()).trim(), expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '157',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com/blog/',
    });
  });

  it('returns 200 for md file', async () => {
    nock.fstab();
    nock('https://www.example.com', {
      reqheaders: {
        authorization: 'Bearer 1234',
      },
    })
      .get('/blog')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'simple.html'), {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });
    const expected = await readFile(resolve(__testdir, 'fixtures', 'simple.md'), 'utf-8');

    const url = new URL('https://localhost');
    url.searchParams.append('path', '/blog.md');
    url.searchParams.append('owner', 'owner');
    url.searchParams.append('repo', 'repo');
    const req = new Request(url.href, {
      headers: {
        authorization: 'Bearer 1234',
      },
    });

    const result = await main(req, { log: console, env: DUMMY_ENV });
    assert.strictEqual(result.status, 200);
    assert.strictEqual((await result.text()).trim(), expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '157',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com/blog',
    });
  });

  it('returns 200 for md index', async () => {
    nock.fstab();
    nock('https://www.example.com', {
      reqheaders: {
        authorization: 'Bearer 1234',
      },
    })
      .get('/blog/')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'simple.html'), {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });
    const expected = await readFile(resolve(__testdir, 'fixtures', 'simple.md'), 'utf-8');

    const url = new URL('https://localhost');
    url.searchParams.append('path', '/blog/index.md');
    url.searchParams.append('owner', 'owner');
    url.searchParams.append('repo', 'repo');
    const req = new Request(url.href, {
      headers: {
        authorization: 'Bearer 1234',
      },
    });

    const result = await main(req, { log: console, env: DUMMY_ENV });
    assert.strictEqual(result.status, 200);
    assert.strictEqual((await result.text()).trim(), expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '157',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com/blog/',
    });
  });

  for (const status of [401, 403, 403]) {
    // eslint-disable-next-line no-loop-func
    it(`returns ${status} for a ${status} response`, async () => {
      nock.fstab();
      nock('https://www.example.com')
        .get('/')
        .reply(status);

      const result = await main(reqUrl('/'), { log: console });
      assert.strictEqual(result.status, status);
      assert.strictEqual(await result.text(), '');
      assert.deepStrictEqual(result.headers.plain(), {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/plain; charset=utf-8',
        'x-error': 'resource not found: https://www.example.com/',
      });
    });
  }

  it('returns 502 for am error response', async () => {
    nock.fstab();
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
    });
  });
});
