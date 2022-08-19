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
import stringify from 'remark-stringify';
import parse from 'rehype-parse';
import { toMdast } from 'hast-util-to-mdast';
import { toString } from 'hast-util-to-string';
import { select } from 'hast-util-select';
import gfm from 'remark-gfm';

import {
  robustTables,
  remarkMatter,
  breaksAsSpaces,
} from '@adobe/helix-markdown-support';

//
// import {
//   TYPE_TABLE,
//   TYPE_HEADER,
//   TYPE_BODY,
//   TYPE_ROW,
//   TYPE_CELL, gridHandlers,
// } from './gridTableMock.js';

export const TYPE_TABLE = 'table';
export const TYPE_HEAD = 'tableHead';
export const TYPE_HEADER = 'tableHeader';
export const TYPE_BODY = 'tableBody';
export const TYPE_ROW = 'tableRow';
export const TYPE_CELL = 'tableCell';

function h(type, children, props = {}) {
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
  return h(TYPE_TABLE, [
    h(TYPE_ROW, [
      h(TYPE_CELL, [
        text(title),
      ], { colSpan: data[0].length }),
    ]),
    ...data.map((row) => h(
      TYPE_ROW,
      row.map((cell) => h(TYPE_CELL, [
        text(cell),
      ])),
    )),
  ]);
}

// function toTable2(title, data) {
//   return node(TYPE_TABLE, [
//     node(TYPE_HEAD, [
//       node(TYPE_ROW, [
//         node(TYPE_CELL, [
//           text(title),
//         ], { colSpan: data[0].length }),
//       ])]),
//     node(
//       TYPE_BODY,
//       data.map((row) => node(
//         TYPE_ROW,
//         row.map((cell) => node(TYPE_CELL, [
//           text(cell),
//         ])),
//       )),
//     ),
//   ]);
// }

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
    mdast.children.push(h('thematicBreak'));
    mdast.children.push(toTable('Metadata', Array.from(meta.entries())));
  }
}

function createSections(main) {
  // replace the 'toplevel' divs by <hr> and move the child nodes up
  let first = true;
  for (let i = 0; i < main.children.length; i += 1) {
    const node = main.children[i];
    if (node.tagName === 'div' && node.children.length) {
      // skip first hr
      if (first) {
        first = false;
        main.children.splice(i, 1, ...node.children);
        i += node.children.length - 1;
      } else {
        node.tagName = 'hr';
        main.children.splice(i + 1, 0, ...node.children);
        i += node.children.length;
      }
    } else {
      // remove all other nodes
      main.children.splice(i, 1);
      i -= 1;
    }
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

  createSections(main);

  const mdast = toMdast(main);

  addMetadata(hast, mdast);

  await robustTables(mdast);

  // noinspection JSVoidFunctionReturnValueUsed
  const md = unified()
    .use(stringify, {
      strong: '*',
      emphasis: '_',
      bullet: '-',
      fence: '`',
      fences: true,
      incrementListMarker: true,
      rule: '-',
      ruleRepetition: 3,
      ruleSpaces: false,
    })
    .use(gfm, {
      // tableCellPadding: false,
      // tablePipeAlign: false,
    })
    .use(breaksAsSpaces)
    .use(remarkMatter)
    // .use(orderedListPlugin)
    .stringify(mdast);
  // const md = toMarkdown(mdast, {
  //   handlers: {
  //     ...gridHandlers,
  //   },
  // });
  const t1 = Date.now();
  log.info(`converted ${url} in ${t1 - t0}ms`);
  return md;
}
