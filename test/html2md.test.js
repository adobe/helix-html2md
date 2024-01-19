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
import { classNameToBlockType, html2md } from '../src/html2md.js';
import { Nock } from './utils.js';

async function test(spec) {
  const html = await readFile(resolve(__testdir, 'fixtures', `${spec}.html`), 'utf-8');
  const expected = await readFile(resolve(__testdir, 'fixtures', `${spec}.md`), 'utf-8');
  const actual = await html2md(html, {
    log: console,
  });
  assert.strictEqual(actual.trim(), expected.trim());
}

describe('html2md Tests', () => {
  let nock;
  beforeEach(() => {
    nock = new Nock().env();
  });

  afterEach(() => {
    nock.done();
  });

  it('convert a simple html', async () => {
    await test('simple');
  });

  it('ignores content outside main', async () => {
    await test('no-main');
  });

  it('ignores non-block divs', async () => {
    await test('no-blocks');
  });

  it('converts empty block divs', async () => {
    await test('empty-block');
  });

  it('converts a document with default-content', async () => {
    await test('default-content');
  });

  it('converts a document with blocks', async () => {
    await test('blocks');
  });

  it('converts a document with multiple sections', async () => {
    await test('multiple-sections');
  });

  it('converts a document with code block and tabs correctly', async () => {
    await test('codeblock');
  });

  it('convert a document with icons', async () => {
    await test('icons');
  });

  it('convert a document with blocks containing tables', async () => {
    await test('block-with-table');
  });

  it('convert a document with underling, sub-, and superscript', async () => {
    await test('sub-sup-u');
  });

  it('convert a document with site core form', async () => {
    await test('site-form');
  });

  it('convert a Adaptive form page', async () => {
    await test('af-form');
  });
});
describe('className to block type tests', () => {
  it('simple', () => {
    assert.strictEqual(classNameToBlockType(['foo']), 'Foo');
  });

  it('single option', () => {
    assert.strictEqual(classNameToBlockType(['foo', 'bar']), 'Foo (bar)');
  });

  it('multiple options', () => {
    assert.strictEqual(classNameToBlockType(['foo', 'bar', 'green']), 'Foo (bar, green)');
  });

  it('multiple wide options', () => {
    assert.strictEqual(classNameToBlockType(['foo', 'super-wide', 'dark-green']), 'Foo (super wide, dark green)');
  });

  it('several words', () => {
    assert.strictEqual(classNameToBlockType(['section-metadata']), 'Section Metadata');
  });

  it('several words and options', () => {
    assert.strictEqual(classNameToBlockType(['foo-bar', 'super-wide', 'dark-green']), 'Foo Bar (super wide, dark green)');
  });
});
