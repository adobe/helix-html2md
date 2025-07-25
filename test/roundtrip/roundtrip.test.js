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
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { html2md } from '../../src/html2md.js';
import { render } from './mock-pipeline.js';

const url = 'http://example.com';

describe('Roundtrip tests', () => {
  async function test(spec, opts = {}) {
    const input = await readFile(resolve(__testdir, 'roundtrip/roundtrip-fixtures', `${spec}.input.html`), 'utf-8');
    if (opts.unspreadLists) {
      // eslint-disable-next-line no-param-reassign
      spec += '-unspread';
    }
    const expected = await readFile(resolve(__testdir, 'roundtrip/roundtrip-fixtures', `${spec}.output.html`), 'utf-8');
    const markdown = await html2md(input, { log: console, url: spec, ...opts });
    console.log(markdown);
    const output = await render(url, markdown);
    assert.strictEqual(output.body?.trim(), expected.trim());
  }

  it('converts \'empty\' HTML input to the expected output', async () => {
    await test('empty');
  });

  it('converts \'some-text\' HTML input to the expected output', async () => {
    await test('some-text');
  });

  it('converts \'all-sections\' HTML input to the expected output', async () => {
    await test('all-sections');
  });

  it('converts \'microdata\' HTML input to the expected output', async () => {
    await test('microdata');
  });

  it('converts \'nested-lists\' HTML input to the expected output', async () => {
    await test('nested-lists');
  });

  it('converts \'nested-lists\' HTML input to the expected output (unspread)', async () => {
    await test('nested-lists', { unspreadLists: true });
  });

  it('converts \'lists-with-pictures\' HTML input to the expected output', async () => {
    await test('lists-with-pictures');
  });

  it('converts \'lists-with-pictures\' HTML input to the expected output (unspread)', async () => {
    await test('lists-with-pictures', { unspreadLists: true });
  });

  it('converts \'lists-with-code\' HTML input to the expected output', async () => {
    await test('lists-with-code');
  });

  it('converts \'lists-with-code\' HTML input to the expected output (unspread)', async () => {
    await test('lists-with-code', { unspreadLists: true });
  });

  it('converts \'tables\' HTML input to expected output', async () => {
    await test('tables');
  });
});
