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
import { select, selectAll } from 'hast-util-select';
import gfm from 'remark-gfm';

import {
  imageReferences,
  sanitizeTextAndFormats,
  sanitizeHeading,
} from '@adobe/helix-markdown-support';
import { remarkMatter } from '@adobe/helix-markdown-support/matter';
import remarkGridTable from '@adobe/remark-gridtables';
import { CONTINUE, visit } from 'unist-util-visit';
import { processImages } from './mdast-process-images.js';
import { processIcons } from './hast-process-icons.js';
import {
  TYPE_GRID_TABLE, TYPE_GT_BODY, TYPE_GT_CELL, TYPE_GT_ROW, handleTableAsGridTable,
} from './mdast-table-handler.js';
import formatPlugin from './markdownFormatPlugin.js';
import { unspreadLists } from './unspread-lists.js';

export class ConstraintsError extends Error {}

const HELIX_META = {
  viewport: true,
};

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

function toGridTable(title, data) {
  return m(TYPE_GRID_TABLE, [
    m(
      TYPE_GT_BODY,
      [m(TYPE_GT_ROW, [
        m(TYPE_GT_CELL, [
          text(title),
        ], { colSpan: data[0].length }),
      ]),
      ...(data.map((row) => m(
        TYPE_GT_ROW,
        row.map((cell) => m(TYPE_GT_CELL, [
          cell,
        ])),
      )))],
    ),
  ]);
}

/**
 * @param {string} str
 * @returns {string}
 * @throws {ConstraintsError} when it is not valid JSON
 */
function assertValidJSON(str) {
  try {
    return JSON.stringify(JSON.parse(str.trim()), null, 2);
  } catch {
    throw new ConstraintsError('invalid json-ld');
  }
}

/**
 * @param {string} str
 * @param {number} [limit]
 * @returns {string}
 * @throws {ConstraintsError} when metadata size limit is exceeded
 */
function assertMetaSizeLimit(str, limit = 128_000) {
  if (str && str.length > limit) {
    throw new ConstraintsError('metadata size limit exceeded');
  }
  return str;
}

/**
 * Check if meta name is allowed:
 *  - non-reserved
 *  - not starting with 'twitter:'
 *    - except 'twitter:label' and 'twitter:data'
 * @param {string} name
 * @returns {boolean}
 */
function isAllowedMetaName(name) {
  if (typeof name !== 'string') {
    return false;
  }
  return !HELIX_META[name] && (
    !name.startsWith('twitter:')
    || name === 'twitter:card'
    || name === 'twitter:image'
    || name.startsWith('twitter:label')
    || name.startsWith('twitter:data')
  );
}

/**
 * Check if meta property is allowed:
 *  - non-reserved
 *  - og:type
 *  - product:*
 * @param {string|undefined} property
 * @returns {boolean}
 */
function isAllowedMetaProperty(property) {
  if (typeof property !== 'string') {
    return false;
  }
  return !HELIX_META[property] && (property.startsWith('product:')
    || property === 'og:image'
    || property === 'og:type');
}

function addMetadata(hast, mdast) {
  const meta = new Map();

  const head = select('head', hast);
  for (const child of head.children) {
    if (child.tagName === 'title') {
      meta.set(text('title'), text(assertMetaSizeLimit(toString(child))));
    } else if (child.tagName === 'meta') {
      const { name, property, content } = child.properties;
      if (isAllowedMetaName(name)) {
        if (name === 'image' || name === 'twitter:image') {
          meta.set(text(name), image(assertMetaSizeLimit(content)));
        } else {
          meta.set(text(name), text(assertMetaSizeLimit(content)));
        }
      } else if (isAllowedMetaProperty(property)) {
        if (property === 'og:image') {
          meta.set(text(property), image(assertMetaSizeLimit(content)));
        } else {
          meta.set(text(property), text(assertMetaSizeLimit(content)));
        }
      }
    } else if (child.tagName === 'script' && child.properties.type === 'application/ld+json') {
      const str = assertMetaSizeLimit(assertValidJSON(toString(child)));
      meta.set(text('json-ld'), text(str));
    }
  }

  const html = select('html', hast);
  if (html.properties?.lang) {
    meta.set(text('html-lang'), text(html.properties.lang));
  }

  const links = selectAll('link', hast);
  links.forEach((link) => {
    const { hrefLang, href } = link.properties;
    if (hrefLang) {
      meta.set(text(`hreflang-${hrefLang}`), text(href));
    }
  });

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

function isBlockEmpty(block) {
  return block.children.length === 0
    || (block.children.length === 1 && block.children[0].type === 'text' && block.children[0].value.trim() === '');
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
    if (isBlockEmpty(block)) {
      maxCols = 1;
      const tableRow = {
        type: 'element',
        tagName: 'tr',
        children: [],
        properties: {},
      };
      rows.push(tableRow);
    }
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

  const { type, numCols } = node.data;
  const blockRows = node.children;
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx += 1) {
    const row = rows[rowIdx];
    row.type = TYPE_GT_ROW;
    const cells = row.children;
    const blockCells = blockRows[rowIdx].children;
    const noOfCells = cells.length;
    for (let idx = 0; idx < noOfCells; idx += 1) {
      const blockCell = blockCells[idx];
      const cell = cells[idx];
      cell.type = TYPE_GT_CELL;
      if (idx === noOfCells - 1 && noOfCells < numCols) {
        cell.colSpan = numCols - idx;
      }
      const blockProperties = blockCell?.properties;
      if (blockProperties) {
        cell.align = blockProperties?.dataAlign;
        cell.valign = blockProperties?.dataValign;
      }
    }
  }

  // add block name row
  const tr = m(TYPE_GT_CELL, [text(type)]);
  if (numCols > 1) {
    tr.colSpan = numCols;
  }

  // create table header and body
  const children = [m(TYPE_GT_BODY, [m(TYPE_GT_ROW, [tr]), ...rows])];
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
    // we wrap the special formats with 'strong' in order to let hast2mdast think it's flow content.
    return m('strong', [m(type, children)], { virtual: true });
  };
}

function cleanupFormats(tree) {
  visit(tree, (node, index, parent) => {
    if (node.type === 'strong' && node.virtual) {
      // eslint-disable-next-line no-param-reassign,prefer-destructuring
      parent.children[index] = node.children[0];
    }
    return CONTINUE;
  });
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

  cleanupFormats(mdast);
  addMetadata(hast, mdast);

  await processImages(log, mdast, mediaHandler, url);
  imageReferences(mdast);
  sanitizeHeading(mdast);
  sanitizeTextAndFormats(mdast);
  unspreadLists(mdast, opts);

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
