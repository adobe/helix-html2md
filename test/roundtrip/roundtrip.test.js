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

const specs = [
  'empty',
  'some-text',
  'all-sections',
  'microdata',
];

describe('Roundtrip tests', () => {
  specs.forEach((spec) => {
    it(`converts '${spec}' HTML input to the expected output`, async () => {
      const input = await readFile(resolve(__testdir, 'roundtrip/roundtrip-fixtures', `${spec}.input.html`), 'utf-8');
      const expected = await readFile(resolve(__testdir, 'roundtrip/roundtrip-fixtures', `${spec}.output.html`), 'utf-8');
      const markdown = await html2md(input, { log: console });
      const output = await render(url, markdown);
      assert.strictEqual(output.body?.trim(), expected.trim());
    });
  });
});
