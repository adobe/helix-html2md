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
import { Request } from '@adobe/helix-fetch';
import { main } from '../src/index.js';
import { Nock } from './utils.js';

function reqUrl(gt) {
  const url = new URL('https://localhost');
  url.searchParams.append('url', 'https://www.example.com');
  url.searchParams.append('owner', 'owner');
  url.searchParams.append('repo', 'repo');
  url.searchParams.append('contentBusId', 'foo-id');
  if (gt) {
    url.searchParams.append('gridTables', 'true');
  }
  return new Request(url.href);
}

describe('Index Tests', () => {
  let nock;
  beforeEach(() => {
    nock = new Nock().env();
  });

  afterEach(() => {
    nock.done();
  });

  it('returns 400 for missing url and path', async () => {
    const url = new URL('https://localhost');
    const result = await main(new Request(url.href), {});
    assert.strictEqual(result.status, 400);
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'url or path parameter is required.',
    });
  });

  for (const param of ['owner', 'repo']) {
    it(`returns 400 for path and missing ${param}`, async () => {
      const url = new URL('https://localhost');
      url.searchParams.append('path', '/index.html');
      url.searchParams.append('owner', 'owner');
      url.searchParams.append('repo', 'repo');
      url.searchParams.delete(param);
      const result = await main(new Request(url.href), {});
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.headers.plain(), {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/plain; charset=utf-8',
        'x-error': 'owner and repo parameters are required in path-mode.',
      });
    });
  }

  it('returns 200 for a simple html', async () => {
    nock('https://www.example.com')
      .get('/')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'simple.html'), {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });
    const expected = await readFile(resolve(__testdir, 'fixtures', 'simple.md'), 'utf-8');
    const result = await main(reqUrl(), {});
    assert.strictEqual(result.status, 200);
    assert.strictEqual((await result.text()).trim(), expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '151',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com',
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

    const url = new URL('https://localhost');
    url.searchParams.append('path', '/index.html');
    url.searchParams.append('owner', 'owner');
    url.searchParams.append('repo', 'repo');
    const req = new Request(url.href, {
      headers: {
        authorization: 'Bearer 1234',
      },
    });

    const result = await main(req, {});
    assert.strictEqual(result.status, 200);
    assert.strictEqual((await result.text()).trim(), expected.trim());
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '151',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com/index.html',
    });
  });

  it('passes gridTables param along', async () => {
    nock('https://www.example.com')
      .get('/')
      .replyWithFile(200, resolve(__testdir, 'fixtures', 'simple.html'));
    const expected = await readFile(resolve(__testdir, 'fixtures', 'simple-gt.md'), 'utf-8');
    const result = await main(reqUrl(true), {});
    assert.strictEqual(result.status, 200);
    assert.strictEqual(await result.text(), expected);
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '162',
      'content-type': 'text/markdown; charset=utf-8',
      'x-source-location': 'https://www.example.com',
    });
  });

  for (const status of [401, 403, 403]) {
    // eslint-disable-next-line no-loop-func
    it(`returns ${status} for a ${status} response`, async () => {
      nock('https://www.example.com')
        .get('/')
        .reply(status);

      const result = await main(reqUrl(), {});
      assert.strictEqual(result.status, status);
      assert.strictEqual(await result.text(), '');
      assert.deepStrictEqual(result.headers.plain(), {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/plain; charset=utf-8',
        'x-error': 'resource not found: https://www.example.com',
      });
    });
  }

  it('returns 502 for am error response', async () => {
    nock('https://www.example.com')
      .get('/')
      .reply(500);

    const result = await main(reqUrl(), {});
    assert.strictEqual(result.status, 502);
    assert.strictEqual(await result.text(), '');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com: 500',
    });
  });
});
