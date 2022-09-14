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
import { visit } from 'unist-util-visit';
import processQueue from '@adobe/helix-shared-process-queue';

/**
 * Process images
 * @param {Console} log
 * @param {object} tree
 * @param {MediaHandler} mediaHandler
 * @param {string} baseUrl
 */
export async function processImages(log, tree, mediaHandler, baseUrl) {
  if (!mediaHandler) {
    return;
  }

  // gather all image nodes
  const images = [];
  visit(tree, (node) => {
    if (node.type === 'image') {
      const { url = '' } = node;
      if (url.startsWith('https://')) {
        images.push(node);
      } else if (url.indexOf(':') < 0) {
        // eslint-disable-next-line no-param-reassign
        node.url = new URL(url, baseUrl).href;
        images.push(node);
      }
    }
    return visit.CONTINUE;
  });

  // upload images
  await processQueue(images, async (node) => {
    // eslint-disable-next-line no-param-reassign
    node.url = (await mediaHandler.getBlob(node.url, baseUrl)).uri;
  }, 8);
}
