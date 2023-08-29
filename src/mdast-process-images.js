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

function createFilter(log, baseUrlStr, imgSrcPolicy) {
  const baseUrl = new URL(baseUrlStr);
  const imgSrcPolicFilters = imgSrcPolicy.map((policyValue) => {
    // filter according to https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/Sources
    if (policyValue === '*') {
      return () => true;
    }

    if (policyValue === 'self') {
      return (url) => baseUrl.host === url.host;
    }

    return (url) => {
      // omit the protocol check, as https:// is enforced earlier already
      // omit the pathname check, as we may not need it (yet)
      const protocolEndIdx = policyValue.indexOf('://');
      let host = protocolEndIdx < 0 ? policyValue : policyValue.substring(protocolEndIdx + 3);
      const slashIdx = host.indexOf('/');
      if (slashIdx >= 0) {
        host = host.substring(0, slashIdx);
      }

      if (host.startsWith('*')) {
        // allow subdomain
        const dotIdx = url.host.indexOf('.');
        return dotIdx > 0 && url.host.substring(dotIdx) === host.substring(1);
      } else {
        return url.host === host;
      }
    };
  });

  return (urlStr) => imgSrcPolicFilters.some((f) => f(urlStr));
}

/**
 * Process images
 * @param {Console} log
 * @param {object} tree
 * @param {MediaHandler} mediaHandler
 * @param {string} baseUrl
 */
export async function processImages(log, tree, mediaHandler, baseUrl, imgSrcPolicy) {
  if (!mediaHandler) {
    return;
  }

  // gather all image nodes
  const filter = createFilter(log, baseUrl, imgSrcPolicy);
  const images = [];
  visit(tree, (node) => {
    if (node.type === 'image') {
      const { url = '' } = node;
      if (url.indexOf(':') < 0) {
        // eslint-disable-next-line no-param-reassign
        node.url = new URL(url, baseUrl).href;
        images.push(node);
      } else if (url.startsWith('https://')) {
        try {
          if (filter(new URL(url))) {
            images.push(node);
          }
        } catch (e) {
          // in case of invalid urls, or other errors
          log.warn(`Failed to test url '${url}': ${e.message}`);
          // eslint-disable-next-line no-param-reassign
          node.url = 'about:error';
        }
      }
    }
    return visit.CONTINUE;
  });

  // upload images
  await processQueue(images, async (node) => {
    const blob = await mediaHandler.getBlob(node.url, baseUrl);
    // eslint-disable-next-line no-param-reassign
    node.url = blob?.uri || 'about:error';
  }, 8);
}
