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
export const TYPE_TABLE = 'gridTable';
export const TYPE_HEADER = 'gtHeader';
export const TYPE_BODY = 'gtBody';
export const TYPE_FOOTER = 'gtFooter';
export const TYPE_ROW = 'gtRow';
export const TYPE_CELL = 'gtCell';

function handleRow(tag, node) {
  let value = '  <tr>';
  for (const child of node.children) {
    value += `<${tag}`;
    if (child.colSpan) {
      value += ` colSpan="${child.colSpan}"`;
    }
    value += '>';
    value += child.children[0].value;
    value += `</${tag}>`;
  }
  value += '</tr>\n';
  return value;
}

function handleHeader(node, parent, context, safeOptions) {
  let value = '';
  for (const child of node.children) {
    value += handleRow('th', child, parent, context, safeOptions);
  }
  return value;
}

function handleBody(node, parent, context, safeOptions) {
  let value = '';
  for (const child of node.children) {
    value += handleRow('td', child, parent, context, safeOptions);
  }
  value += '';
  return value;
}

function handleTable(node, parent, context, safeOptions) {
  const exit = context.enter(TYPE_TABLE);
  let value = '<table>\n';
  for (const child of node.children) {
    if (child.type === TYPE_HEADER) {
      value += handleHeader(child, node, context, safeOptions);
    } else if (child.type === TYPE_BODY) {
      value += handleBody(child, node, context, safeOptions);
    }
  }

  value += '</table>';
  exit();
  return value;
}

export const gridHandlers = {
  [TYPE_TABLE]: handleTable,
};
