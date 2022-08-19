/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { unified } from 'unified';
import parse from 'rehype-parse';
import { toMdast } from 'hast-util-to-mdast';
import { toString } from 'hast-util-to-string';
import { toMarkdown } from 'mdast-util-to-markdown';
import { select } from 'hast-util-select';

import {
  TYPE_TABLE,
  TYPE_HEADER,
  TYPE_BODY,
  TYPE_ROW,
  TYPE_CELL, gridHandlers,
} from './gridTableMock.js';

function node(type, children, props = {}) {
  return {
    type,
    children,
    ...props,
  };
}
function text(value) {
  return {
    type: 'text',
    value,
  };
}

const HELIX_META = new Set(Array.from([
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'viewport',
]));

function toTable(title, data) {
  return node(TYPE_TABLE, [
    node(TYPE_HEADER, [
      node(TYPE_ROW, [
        node(TYPE_CELL, [
          text(title),
        ], { colSpan: data[0].length }),
      ])]),
    node(
      TYPE_BODY,
      data.map((row) => node(
        TYPE_ROW,
        row.map((cell) => node(TYPE_CELL, [
          text(cell),
        ])),
      )),
    ),
  ]);
}

function addMetadata(hast, mdast) {
  const meta = new Map();

  const head = select('head', hast);
  for (const child of head.children) {
    if (child.tagName === 'title') {
      meta.set('title', toString(child));
    } else {
      const { name, content } = child.properties ?? {};
      if (name && !HELIX_META.has(name)) {
        meta.set(name, content);
      }
    }
  }

  if (meta.size) {
    mdast.children.push(toTable('Metadata', Array.from(meta.entries())));
  }
}

export async function html2md(html, opts) {
  const { log, url } = opts;
  const t0 = Date.now();
  const hast = unified()
    .use(parse)
    .parse(html);

  const main = select('main', hast);
  if (!main) {
    log.info(`${url} contains no <main>`);
    return '';
  }

  const mdast = toMdast(main);

  addMetadata(hast, mdast);

  const md = toMarkdown(mdast, {
    handlers: {
      ...gridHandlers,
    },
  });
  const t1 = Date.now();
  log.info(`converted ${url} in ${t1 - t0}ms`);
  return md;
}
