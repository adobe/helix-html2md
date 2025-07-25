/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import {
  TYPE_TABLE,
  TYPE_HEADER,
  TYPE_BODY,
  TYPE_ROW,
  TYPE_CELL,
  TYPE_FOOTER,
} from '@adobe/micromark-extension-gridtables';

export const TYPE_GRID_TABLE = TYPE_TABLE;
export const TYPE_GT_BODY = TYPE_BODY;
export const TYPE_GT_ROW = TYPE_ROW;
export const TYPE_GT_CELL = TYPE_CELL;

function toGridCell(cell, state) {
  const node = {
    ...cell,
    children: state.all(cell),
    type: TYPE_CELL,
  };
  if ('rowSpan' in node.properties) {
    node.rowSpan = parseInt(node.properties.rowSpan, 10);
  }
  if ('colSpan' in node.properties) {
    node.colSpan = parseInt(node.properties.colSpan, 10);
  }
  return node;
}

function toGridRow(row, state) {
  return {
    ...row,
    children: row.children.map((cell) => toGridCell(cell, state)),
    type: TYPE_ROW,
  };
}

function toGridRows(rows, state) {
  return rows.map((r) => toGridRow(r, state));
}

const tableToGridTable = (table, state) => {
  for (const child of table.children) {
    if (child.tagName === 'thead') {
      child.type = TYPE_HEADER;
      child.children = toGridRows(child.children, state);
    } else if (child.tagName === 'tbody') {
      child.type = TYPE_BODY;
      child.children = toGridRows(child.children, state);
    } else if (child.tagName === 'tfoot') {
      child.type = TYPE_FOOTER;
      child.children = toGridRows(child.children, state);
    }
  }
  return {
    ...table,
    type: TYPE_TABLE,
  };
};

export function handleTableAsGridTable(state, tableNode) {
  return tableToGridTable(tableNode, state);
}
