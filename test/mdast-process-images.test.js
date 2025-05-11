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

/* eslint-env mocha */
import assert from 'assert';
import { processImages, TooManyImagesError } from '../src/mdast-process-images.js';

const mockLog = {
  debug: () => {},
  warn: () => {},
};

const mockMediaHandler = {
  getBlob: async (url) => {
    if (url === 'about:error') {
      throw new Error('Failed to get image');
    }
    return { uri: url };
  },
};

const baseUrl = 'https://example.com';

describe('mdast-process-images Tests', () => {
  it('handles Adobe AEM asset URLs', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/adobe/assets/urn:aaid:aem:12345-abcde',
              alt: 'AEM Asset',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://regular-image.com/image.jpg',
              alt: 'Regular Image',
            },
          ],
        },
      ],
    };

    await processImages(mockLog, tree, mockMediaHandler, baseUrl);

    // Verify AEM asset is marked with className and metadata
    const aemImageNode = tree.children[0].children[0];
    assert.ok(aemImageNode.data, 'AEM image node should have data property');
    assert.ok(aemImageNode.data.hProperties, 'AEM image should have hProperties');
    assert.strictEqual(aemImageNode.data.hProperties.className, 'adobe-aem-asset', 'AEM image should have correct className');
    assert.strictEqual(aemImageNode.data.aemAsset, true, 'AEM image should have aemAsset flag');

    // Verify regular image doesn't have the marking
    const regularImageNode = tree.children[1].children[0];
    assert.ok(!regularImageNode.data || !regularImageNode.data.aemAsset, 'Regular image should not have aemAsset flag');
  });
});
