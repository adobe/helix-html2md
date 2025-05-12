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
import { visit, CONTINUE } from 'unist-util-visit';
import processQueue from '@adobe/helix-shared-process-queue';

export class TooManyImagesError extends Error {
}

function isExternalImage(url, externalImages) {
  const patterns = externalImages.map((pattern) => new RegExp(pattern));
  return patterns.some((pattern) => pattern.test(url));
}

/**
 * Process images
 * @param {Console} log
 * @param {object} tree
 * @param {MediaHandler} mediaHandler
 * @param {string} baseUrl
 * @param {Array<string>} externalImages - Array of url patterns to detect external images
 */
export async function processImages(log, tree, mediaHandler, baseUrl, externalImages = []) {
  if (!mediaHandler) {
    return;
  }
  // gather all image nodes
  const images = new Map();
  const externalImageNodes = new Map();

  const register = (node) => {
    // Check if this is an external image
    if (node.data?.externalImage) {
      if (externalImageNodes.has(node.url)) {
        externalImageNodes.get(node.url).push(node);
      } else {
        externalImageNodes.set(node.url, [node]);
      }
      log.debug(`Skipping upload for external image: ${node.url}`);
      return;
    }

    // Regular image processing
    if (images.has(node.url)) {
      images.get(node.url).push(node);
    } else {
      images.set(node.url, [node]);
    }
  };

  visit(tree, (node) => {
    if (node.type === 'image') {
      const { url = '' } = node;
      if (url.indexOf(':') < 0) {
        // eslint-disable-next-line no-param-reassign
        node.url = new URL(url, baseUrl).href;
        register(node);
      } else if (url.startsWith('https://')) {
        if (isExternalImage(url, externalImages)) {
          // Add custom class to the node for external images
          const data = node.data || {};
          const hProperties = data.hProperties || {};
          hProperties.className = 'external-image';
          // eslint-disable-next-line no-param-reassign
          node.data = { ...data, hProperties };

          // eslint-disable-next-line no-param-reassign
          node.data.externalImage = true;

          log.debug(`Marked external image: ${url}`);
        }

        register(node);
      }
    }
    return CONTINUE;
  });

  if (images.size + externalImageNodes.size > 200) {
    throw new TooManyImagesError(`maximum number of images reached: ${images.size + externalImageNodes.size} of 200 max.`);
  }

  // upload regular images
  await processQueue(images.entries(), async ([url, nodes]) => {
    try {
      const blob = await mediaHandler.getBlob(url, baseUrl);
      // eslint-disable-next-line no-param-reassign
      url = blob?.uri || 'about:error';
      /* c8 ignore next 6 */
    } catch (e) {
      // in case of invalid urls, or other errors
      log.warn(`Failed to fetch image for url '${url}': ${e.message}`);
      // eslint-disable-next-line no-param-reassign
      url = 'about:error';
    }
    for (const node of nodes) {
      node.url = url;
    }
  }, 8);
}
