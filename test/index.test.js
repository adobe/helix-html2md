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
import assert from 'assert';
import { Request } from '@adobe/helix-fetch';
import { main } from '../src/index.js';
import { Nock } from './utils.js';

function req() {
  const url = new URL('https://localhost');
  url.searchParams.append('url', 'https://www.example.com');
  url.searchParams.append('owner', 'owner');
  url.searchParams.append('repo', 'repo');
  url.searchParams.append('contentBusId', 'foo-id');
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

  for (const param of ['url', 'owner', 'repo', 'contentBusId']) {
    it(`returns 400 for missing ${param}`, async () => {
      const url = new URL('https://localhost');
      url.searchParams.append('url', 'https://www.example.com');
      url.searchParams.append('owner', 'owner');
      url.searchParams.append('repo', 'repo');
      url.searchParams.append('contentBusId', 'foo-id');
      url.searchParams.delete(param);
      const result = await main(new Request(url.href), {});
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.headers.plain(), {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/plain; charset=utf-8',
        'x-error': param === 'url' ? 'url parameter is required.' : 'owner, repo and contentBusId parameters are required.',
      });
    });
  }

  it('returns 200 for a simple html', async () => {
    nock('https://www.example.com')
      .get('/')
      .reply(200, '<html><body>Hello, world.</body></html>');

    const result = await main(req(), {});
    assert.strictEqual(result.status, 200);
    assert.strictEqual(await result.text(), 'Hello, world.\n');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '14',
      'content-type': 'text/markdown; charset=utf-8',
      'x-source-location': 'https://www.example.com',
    });
  });

  it('includes last-modified in response', async () => {
    nock('https://www.example.com')
      .get('/')
      .reply(200, '<html lang="en"><body>Hello, world.</body></html>', {
        'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      });

    const result = await main(req(), {});
    assert.strictEqual(result.status, 200);
    assert.strictEqual(await result.text(), 'Hello, world.\n');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-length': '14',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Sat, 22 Feb 2031 15:28:00 GMT',
      'x-source-location': 'https://www.example.com',
    });
  });

  for (const status of [401, 403, 403]) {
    // eslint-disable-next-line no-loop-func
    it(`returns ${status} for a ${status} response`, async () => {
      nock('https://www.example.com')
        .get('/')
        .reply(status);

      const result = await main(req(), {});
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

    const result = await main(req(), {});
    assert.strictEqual(result.status, 502);
    assert.strictEqual(await result.text(), '');
    assert.deepStrictEqual(result.headers.plain(), {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'error fetching resource at https://www.example.com: 500',
    });
  });
});
