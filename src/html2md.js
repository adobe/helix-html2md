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
/* eslint-disable no-continue */
import { unified } from 'unified';
import stringify from 'remark-stringify';
import parse from 'rehype-parse';
import { toMdast } from 'hast-util-to-mdast';
import { toString } from 'hast-util-to-string';
import { select } from 'hast-util-select';
import gfm from 'remark-gfm';

import {
  imageReferences,
  sanitizeTextAndFormats,
} from '@adobe/helix-markdown-support';
import { remarkMatter } from '@adobe/helix-markdown-support/matter';
import remarkGridTable from '@adobe/remark-gridtables';
import { processImages } from './mdast-process-images.js';
import { processIcons } from './hast-process-icons.js';
import {
  TYPE_GRID_TABLE, TYPE_GT_BODY, TYPE_GT_CELL, TYPE_GT_HEADER, TYPE_GT_ROW, handleTableAsGridTable,
} from './mdast-table-handler.js';
import formatPlugin from './markdownFormatPlugin.js';

function m(type, children, props = {}) {
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

function image(url) {
  return {
    type: 'image',
    url,
  };
}

const HELIX_META = new Set(Array.from([
  'viewport',
]));

function toGridTable(title, data) {
  return m(TYPE_GRID_TABLE, [
    m(TYPE_GT_HEADER, [
      m(TYPE_GT_ROW, [
        m(TYPE_GT_CELL, [
          text(title),
        ], { colSpan: data[0].length }),
      ])]),
    m(
      TYPE_GT_BODY,
      data.map((row) => m(
        TYPE_GT_ROW,
        row.map((cell) => m(TYPE_GT_CELL, [
          cell,
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
      meta.set(text('title'), text(toString(child)));
    } else if (child.tagName === 'meta') {
      const { name, content } = child.properties;
      if (name && !HELIX_META.has(name) && !name.startsWith('twitter:')) {
        if (name === 'image') {
          meta.set(text(name), image(content));
        } else {
          meta.set(text(name), text(content));
        }
      }
    }
  }

  if (meta.size) {
    mdast.children.push(toGridTable('Metadata', Array.from(meta.entries())));
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

export function classNameToBlockType(className) {
  let blockType = className.shift();
  blockType = blockType.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
  if (className.length) {
    blockType += ` (${className.map((s) => s.split('-').join(' ')).join(', ')})`;
  }
  return blockType;
}

/**
 * Detects blocks and converts the divs to `block` tags, which are later converted to tables.
 * @param main
 */
function createBlocks(main) {
  // a block must start with a `<div classname="...">` and have at least 1 _row_.
  for (const block of main.children) {
    if (block.tagName !== 'div') {
      continue;
    }
    const { className = [] } = block.properties;
    if (!className.length) {
      continue;
    }
    // validate 'table structure'
    const rows = [];
    let maxCols = 0;
    for (const row of block.children) {
      if (row.tagName === 'div') {
        const tableRow = {
          type: 'element',
          tagName: 'tr',
          children: [],
          properties: {},
        };
        rows.push(tableRow);
        let numCols = 0;
        for (const cell of row.children) {
          if (cell.tagName === 'div') {
            cell.tagName = 'td';
            numCols += 1;
            tableRow.children.push(cell);
          }
        }
        maxCols = Math.max(maxCols, numCols);
      }
    }
    if (!rows.length || !maxCols) {
      continue;
    }

    // convert block to table
    block.tagName = 'block';
    block.properties = {};
    block.children = rows;
    block.data = {
      type: classNameToBlockType(className),
      numCols: maxCols,
    };
  }
}

function handleBlockAsGridTable(state, node) {
  const rows = state.all(node);

  for (const row of rows) {
    row.type = TYPE_GT_ROW;
    for (const cell of row.children) {
      cell.type = TYPE_GT_CELL;
    }
  }

  // add header row
  const { type, numCols } = node.data;
  const th = m(TYPE_GT_CELL, [text(type)]);
  if (numCols > 1) {
    th.colSpan = numCols;
  }

  // create table header and body
  const children = [
    m(TYPE_GT_HEADER, [m(TYPE_GT_ROW, [th])]),
    m(TYPE_GT_BODY, rows),
  ];
  return m(TYPE_GRID_TABLE, children);
}

/**
 * creates a mdast node of the given type.
 * @param {string} type
 * @return {Node}
 */
function handleFormat(type) {
  return (state, node) => {
    const children = state.all(node);
    return m(type, children);
  };
}

export async function html2md(html, opts) {
  const { log, url, mediaHandler } = opts;
  const t0 = Date.now();
  const hast = unified()
    .use(parse)
    .parse(html);

  const main = select('main', hast);
  if (!main) {
    log.info(`${url} contains no <main>`);
    return '';
  }

  processIcons(main);
  createSections(main);
  createBlocks(main);

  const mdast = toMdast(main, {
    handlers: {
      block: handleBlockAsGridTable,
      table: handleTableAsGridTable,
      sub: handleFormat('subscript'),
      sup: handleFormat('superscript'),
      u: handleFormat('underline'),
    },
  });

  addMetadata(hast, mdast);

  await processImages(log, mdast, mediaHandler, url);
  imageReferences(mdast);
  sanitizeTextAndFormats(mdast);

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
    .use(gfm)
    .use(remarkMatter)
    .use(remarkGridTable)
    // .use(orderedListPlugin)
    .use(formatPlugin)
    .stringify(mdast);

  const t1 = Date.now();
  log.info(`converted ${url} in ${t1 - t0}ms`);
  return md;
}
