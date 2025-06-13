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
 * Unwrap picture elements and just keep the img child.
 * @param {object} tree
 */
export function hastUnwrapPictures(tree) {
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
        parent.children.splice(index, 1, img);
        return index;
      } else {
        parent.children.splice(index, 1);
        return index;
      }
    }
    return CONTINUE;
  });
}
