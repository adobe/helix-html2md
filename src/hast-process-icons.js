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
import { visit } from 'unist-util-visit';

/**
 * Process hast tree and search for span's which represent an icon.
 * In-place replacement of the element with a special text node, used by the html-pipeline
 * @param {object} hast tree
 */
export async function processIcons(tree) {
  visit(tree, 'element', (node) => {
    if (node.tagName === 'span') {
      if (node.properties && node.properties.className && node.properties.className.includes('icon')) {
        const className = node.properties.className.find((attr) => attr.startsWith('icon-'));
        if (className) {
          // eslint-disable-next-line no-param-reassign
          node.type = 'text';
          // eslint-disable-next-line no-param-reassign
          node.value = `:${className.substring(5)}:`;
          // eslint-disable-next-line no-param-reassign
          delete node.tagName;
          // eslint-disable-next-line no-param-reassign
          delete node.children;
        }
      }
    }
  });
}
