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
import { find } from 'unist-util-find';

/**
 * Collapse (un-spread) all lists
 * @param {object} tree
 */
export function unspreadLists(tree, url, log) {
  let listsWithSpread = 0;
  let listItemWithPictures = 0;

  visit(tree, (node) => {
    // lists are spread if the contain nested lists
    // list items are spread if they contain multiple block elements (e.g. code, paragraph, code)
    // list items are not spread if they contain one or more pictures
    if (node.type === 'list' || node.type === 'listItem') {
      if (node.spread) {
        // eslint-disable-next-line no-param-reassign
        // node.spread = false;
        listsWithSpread += 1;
      }
      if (node.type === 'listItem') {
        // if there is a picture in the list item, it is not spread but the children are all
        // paragraphs which different from the markdown generated form a google doc or docx
        if (find(node, { type: 'imageReference' })) {
          // const children = [];
          // node.children.forEach((child) => children.push(...child.children));
          // eslint-disable-next-line no-param-reassign
          // node.children = children;
          listItemWithPictures += 1;
        }
      }
    }
    return CONTINUE;
  });

  if (listsWithSpread > 0 || listItemWithPictures > 0) {
    log.info(`Spread list seen in ${url}, listsWithSpread=${listsWithSpread}, listItemWithPictures=${listItemWithPictures}`);
  }
}
