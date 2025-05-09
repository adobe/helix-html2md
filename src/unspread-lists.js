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
export function unspreadLists(tree) {
  visit(tree, (node) => {
    if (node.type === 'list' || node.type === 'listItem') {
      // eslint-disable-next-line no-param-reassign
      node.spread = false;
      // check if there is a child paragraph that wraps an image
      for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i];
        if (child.type === 'paragraph' && child.children.length === 1 && child.children[0].type === 'imageReference') {
          // eslint-disable-next-line no-param-reassign,prefer-destructuring
          node.children[i] = child.children[0];
        }
      }
    }
    return CONTINUE;
  });
}
