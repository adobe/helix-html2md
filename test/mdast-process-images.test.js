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

describe('mdast-process-images Tests', () => {
  let processedUrls;

  const mockLog = {
    debug: () => {},
    warn: () => {},
  };

  const mockMediaHandler = {
    getBlob: async (url) => {
      processedUrls.push(url);
      if (url === 'about:error') {
        throw new Error('Failed to get image');
      }
      return { uri: url };
    },
  };

  const baseUrl = 'https://example.com';

  beforeEach(() => {
    processedUrls = [];
  });

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

    // Verify the AEM asset URL remains unchanged
    assert.strictEqual(aemImageNode.url, 'https://example.com/adobe/assets/urn:aaid:aem:12345-abcde', 'AEM image URL should remain unchanged');

    // Verify regular image doesn't have the marking
    const regularImageNode = tree.children[1].children[0];
    assert.ok(!regularImageNode.data || !regularImageNode.data.aemAsset, 'Regular image should not have aemAsset flag');

    // Verify only the regular image was processed by mediaHandler
    assert.strictEqual(processedUrls.length, 1, 'Only regular image should be processed');
    assert.strictEqual(processedUrls[0], 'https://regular-image.com/image.jpg', 'Regular image should be processed');
  });

  it('handles duplicate Adobe AEM asset URLs', async () => {
    const sameAemUrl = 'https://example.com/adobe/assets/urn:aaid:aem:same-id';
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: sameAemUrl,
              alt: 'AEM Asset 1',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: sameAemUrl,
              alt: 'AEM Asset 2',
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

    // Verify AEM asset nodes
    const aemImageNode1 = tree.children[0].children[0];
    const aemImageNode2 = tree.children[1].children[0];

    // Both AEM assets should be marked
    assert.strictEqual(aemImageNode1.data.aemAsset, true, 'First AEM image should have aemAsset flag');
    assert.strictEqual(aemImageNode2.data.aemAsset, true, 'Second AEM image should have aemAsset flag');

    // Both AEM assets should keep their original URLs
    assert.strictEqual(aemImageNode1.url, sameAemUrl, 'First AEM image URL should remain unchanged');
    assert.strictEqual(aemImageNode2.url, sameAemUrl, 'Second AEM image URL should remain unchanged');

    // Only regular image should be processed
    assert.strictEqual(processedUrls.length, 1, 'Only regular image should be processed');
    assert.strictEqual(processedUrls[0], 'https://regular-image.com/image.jpg', 'Regular image should be processed');
  });

  it('throws error for too many images', async () => {
    // Create 201 unique image URLs to exceed the limit
    const children = [];
    for (let i = 0; i < 201; i += 1) {
      children.push({
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: `https://example.com/image-${i}.jpg`,
          },
        ],
      });
    }

    const tree = {
      type: 'root',
      children,
    };

    await assert.rejects(
      async () => processImages(mockLog, tree, mockMediaHandler, baseUrl),
      (err) => {
        assert.ok(err instanceof TooManyImagesError);
        assert.ok(err.message.includes('maximum number of images reached'));
        return true;
      },
    );
  });

  it('handles image load failures gracefully', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'about:error',
              alt: 'Bad Image',
            },
          ],
        },
      ],
    };

    await processImages(mockLog, tree, mockMediaHandler, baseUrl);

    // Verify the URL is set to about:error
    const badImageNode = tree.children[0].children[0];
    assert.strictEqual(badImageNode.url, 'about:error');
  });

  it('skips processing AEM asset images while counting them toward limit', async () => {
    // Create 150 AEM assets and 50 regular images (should be under limit)
    const children = [];
    for (let i = 0; i < 150; i += 1) {
      children.push({
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: `https://example.com/adobe/assets/urn:aaid:aem:${i}`,
            alt: `AEM Asset ${i}`,
          },
        ],
      });
    }

    for (let i = 0; i < 50; i += 1) {
      children.push({
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: `https://example.com/regular-${i}.jpg`,
            alt: `Regular Image ${i}`,
          },
        ],
      });
    }

    const tree = {
      type: 'root',
      children,
    };

    await processImages(mockLog, tree, mockMediaHandler, baseUrl);

    // Verify only regular images were processed
    assert.strictEqual(processedUrls.length, 50, 'Only regular images should be processed');

    // Check that we'd hit the limit with 151 AEM assets and 50 regular images
    const childrenOverLimit = [...children];
    childrenOverLimit.push({
      type: 'paragraph',
      children: [
        {
          type: 'image',
          url: 'https://example.com/adobe/assets/urn:aaid:aem:extra',
          alt: 'Extra AEM Asset',
        },
      ],
    });

    const treeOverLimit = {
      type: 'root',
      children: childrenOverLimit,
    };

    await assert.rejects(
      async () => processImages(mockLog, treeOverLimit, mockMediaHandler, baseUrl),
      TooManyImagesError,
    );
  });
});
