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
/* eslint-disable no-param-reassign */
import { CONTINUE, visit } from 'unist-util-visit';

/**
 * Unwrap picture elements and just keep the img child. Importing picture elements will create a
 * mdast paragraph, so we try to collect non block siblings in the same paragraph
 * @param {object} tree
 */
export function hastUnwrapPictures(tree, createParagraph) {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName === 'picture') {
      let img = null;
      for (const child of node.children) {
        if (child.type === 'element' && child.tagName === 'img') {
          img = child;
          break;
        }
      }
      if (img) {
        if (createParagraph) {
          // convert picture to `p`
          node.tagName = 'p';
          node.children = [img];
          for (let i = index + 1; i < parent.children.length; i += 1) {
            const sibling = parent.children[i];
            const flow = ['p', 'picture', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'div'];
            if (flow.includes(sibling.tagName)) {
              break;
            }
            node.children.push(parent.children.splice(i, 1)[0]);
            i -= 1;
          }
        } else {
          parent.children.splice(index, 1, img);
        }
        return index;
      } else {
        parent.children.splice(index, 1);
        return index;
      }
    }
    return CONTINUE;
  });
}
