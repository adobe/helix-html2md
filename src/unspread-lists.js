/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { visit, CONTINUE } from 'unist-util-visit';

/**
 * Collapse (un-spread) all lists
 * @param {object} tree
 */
export function unspreadLists(tree, url, log) {
  let listsWithSpread = 0;
  let listItemsWithMultipleParagraphs = 0;

  visit(tree, (node) => {
    if (node.type === 'list' || node.type === 'listItem') {
      // eslint-disable-next-line no-param-reassign
      // node.spread = false;
      if (node.spread) {
        listsWithSpread += 1;
      }
    }
    if (node.type === 'listItem' && node.children.length > 1) {
      // unwrap paragraphs if multiple children
      // const children = [];
      // node.children.forEach((child) => children.push(...child.children));
      // eslint-disable-next-line no-param-reassign
      // node.children = children;
      listItemsWithMultipleParagraphs += 1;
    }
    return CONTINUE;
  });

  if (listsWithSpread > 0 || listItemsWithMultipleParagraphs > 0) {
    log.info(`Spread list seen in ${url}, listsWithSpread=${listsWithSpread}, listItemsWithMultipleParagraphs=${listItemsWithMultipleParagraphs}`);
  }
}
