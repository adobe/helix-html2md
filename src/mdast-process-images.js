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

/**
 * Process images
 * @param {Console} log
 * @param {object} tree
 * @param {MediaHandler} mediaHandler
 * @param {string} baseUrl
 * @param {Array<string>} externalImageUrlPrefixes Array of url prefixes to detect external images
 */
export async function processImages(
  log,
  tree,
  mediaHandler,
  baseUrl,
  externalImageUrlPrefixes = [],
) {
  if (!mediaHandler) {
    return;
  }
  // gather all image nodes
  const images = new Map();
  // Convert externalImageUrlPrefixes to an array if not already
  if (!Array.isArray(externalImageUrlPrefixes)) {
    // eslint-disable-next-line no-param-reassign
    externalImageUrlPrefixes = [externalImageUrlPrefixes];
  }

  const register = (node) => {
    // Check if this is an external image
    const { url = '' } = node;
    const isExternalImage = externalImageUrlPrefixes
      .some((externalImageUrlPrefix) => url.startsWith(externalImageUrlPrefix));
    if (isExternalImage) {
      log.debug(`Skipping upload for external image: ${url}`);
      return;
    }

    // Regular image processing
    if (images.has(url)) {
      images.get(url).push(node);
    } else {
      images.set(url, [node]);
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
        register(node);
      }
    }
    return CONTINUE;
  });

  if (images.size > 200) {
    throw new TooManyImagesError(`maximum number of images reached: ${images.size} of 200 max.`);
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
