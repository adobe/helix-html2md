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

  it('handles external asset URLs', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/adobe/assets/urn:aaid:aem:12345-abcde',
              alt: 'External Asset',
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

    await processImages(mockLog, tree, mockMediaHandler, baseUrl, [/\/adobe\/assets\/urn:aaid:aem:/]);

    // Verify external asset is marked with className and metadata
    const externalAssetNode = tree.children[0].children[0];
    assert.ok(externalAssetNode.data, 'External asset node should have data property');
    assert.ok(externalAssetNode.data.hProperties, 'External asset should have hProperties');
    assert.strictEqual(externalAssetNode.data.hProperties.className, 'external-image', 'External asset should have correct className');
    assert.strictEqual(externalAssetNode.data.externalImage, true, 'External asset should have externalImage flag');

    // Verify the external asset URL remains unchanged
    assert.strictEqual(externalAssetNode.url, 'https://example.com/adobe/assets/urn:aaid:aem:12345-abcde', 'External asset URL should remain unchanged');

    // Verify regular image doesn't have the marking
    const regularImageNode = tree.children[1].children[0];
    assert.ok(!regularImageNode.data || !regularImageNode.data.externalImage, 'Regular image should not have externalImage flag');

    // Verify only the regular image was processed by mediaHandler
    assert.strictEqual(processedUrls.length, 1, 'Only regular image should be processed');
    assert.strictEqual(processedUrls[0], 'https://regular-image.com/image.jpg', 'Regular image should be processed');
  });

  it('handles duplicate external asset URLs', async () => {
    const sameExternalUrl = 'https://example.com/adobe/assets/urn:aaid:aem:same-id';
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: sameExternalUrl,
              alt: 'External Asset 1',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: sameExternalUrl,
              alt: 'External Asset 2',
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

    await processImages(mockLog, tree, mockMediaHandler, baseUrl, [/\/adobe\/assets\/urn:aaid:aem:/]);

    // Verify external asset nodes
    const externalAssetNode1 = tree.children[0].children[0];
    const externalAssetNode2 = tree.children[1].children[0];

    // Both external assets should be marked
    assert.strictEqual(externalAssetNode1.data.externalImage, true, 'First external asset should have externalImage flag');
    assert.strictEqual(externalAssetNode2.data.externalImage, true, 'Second external asset should have externalImage flag');

    // Both external assets should keep their original URLs
    assert.strictEqual(externalAssetNode1.url, sameExternalUrl, 'First external asset URL should remain unchanged');
    assert.strictEqual(externalAssetNode2.url, sameExternalUrl, 'Second external asset URL should remain unchanged');

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

  it('skips processing external asset images while counting them toward limit', async () => {
    // Create 150 external assets and 50 regular images (should be under limit)
    const children = [];
    for (let i = 0; i < 150; i += 1) {
      children.push({
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: `https://example.com/adobe/assets/urn:aaid:aem:${i}`,
            alt: `External Asset ${i}`,
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

    await processImages(mockLog, tree, mockMediaHandler, baseUrl, [/\/adobe\/assets\/urn:aaid:aem:/]);

    // Verify only regular images were processed
    assert.strictEqual(processedUrls.length, 50, 'Only regular images should be processed');

    // Check that we'd hit the limit with 151 external assets and 50 regular images
    const childrenOverLimit = [...children];
    childrenOverLimit.push({
      type: 'paragraph',
      children: [
        {
          type: 'image',
          url: 'https://example.com/adobe/assets/urn:aaid:aem:extra',
          alt: 'Extra External Asset',
        },
      ],
    });

    const treeOverLimit = {
      type: 'root',
      children: childrenOverLimit,
    };

    await assert.rejects(
      async () => processImages(mockLog, treeOverLimit, mockMediaHandler, baseUrl, [/\/adobe\/assets\/urn:aaid:aem:/]),
      TooManyImagesError,
    );
  });

  it('handles multiple external image patterns', async () => {
    // Create a tree with different types of images matching different patterns
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/adobe/assets/urn:aaid:aem:12345',
              alt: 'AEM Asset',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://dam.example.com/content/asset.jpg',
              alt: 'DAM Asset',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://cdn.example.net/external/image.png',
              alt: 'CDN Asset',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/regular-image.jpg',
              alt: 'Regular Image',
            },
          ],
        },
      ],
    };

    const externalPatterns = [
      /\/adobe\/assets\/urn:aaid:aem:/, // AEM assets
      /^https:\/\/dam\.example\.com\//, // DAM assets
      /^https:\/\/cdn\.example\.net\//, // CDN assets
    ];

    await processImages(mockLog, tree, mockMediaHandler, baseUrl, externalPatterns);

    // Verify all external images are marked correctly
    const aemNode = tree.children[0].children[0];
    const damNode = tree.children[1].children[0];
    const cdnNode = tree.children[2].children[0];
    const regularNode = tree.children[3].children[0];

    // Check external image flags
    assert.strictEqual(aemNode.data.externalImage, true, 'AEM asset should be marked as external');
    assert.strictEqual(damNode.data.externalImage, true, 'DAM asset should be marked as external');
    assert.strictEqual(cdnNode.data.externalImage, true, 'CDN asset should be marked as external');
    assert.ok(!regularNode.data || !regularNode.data.externalImage, 'Regular image should not be marked as external');

    // Check URLs remain unchanged for external images
    assert.strictEqual(aemNode.url, 'https://example.com/adobe/assets/urn:aaid:aem:12345');
    assert.strictEqual(damNode.url, 'https://dam.example.com/content/asset.jpg');
    assert.strictEqual(cdnNode.url, 'https://cdn.example.net/external/image.png');

    // Verify only the regular image was processed
    assert.strictEqual(processedUrls.length, 1, 'Only regular image should be processed');
    assert.strictEqual(processedUrls[0], 'https://example.com/regular-image.jpg');
  });

  it('handles the edge case with 200 external images', async () => {
    // Create exactly 200 external images
    const children = [];
    for (let i = 0; i < 200; i += 1) {
      children.push({
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: `https://example.com/adobe/assets/urn:aaid:aem:${i}`,
            alt: `External Asset ${i}`,
          },
        ],
      });
    }

    const tree = {
      type: 'root',
      children,
    };

    // This should not throw an error
    await processImages(mockLog, tree, mockMediaHandler, baseUrl, [/\/adobe\/assets\/urn:aaid:aem:/]);

    // Verify no images were processed (all are external)
    assert.strictEqual(processedUrls.length, 0, 'No images should be processed');

    // Add one more image to go over the limit
    const treeOverLimit = {
      type: 'root',
      children: [
        ...children,
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/regular-image.jpg',
              alt: 'Regular Image',
            },
          ],
        },
      ],
    };

    // This should throw an error
    await assert.rejects(
      async () => processImages(mockLog, treeOverLimit, mockMediaHandler, baseUrl, [/\/adobe\/assets\/urn:aaid:aem:/]),
      TooManyImagesError,
    );
  });

  it('processes all images when no external patterns are provided', async () => {
    // Create a tree with different types of images
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/adobe/assets/urn:aaid:aem:12345',
              alt: 'AEM Asset',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://dam.example.com/content/asset.jpg',
              alt: 'DAM Asset',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://cdn.example.net/external/image.png',
              alt: 'CDN Asset',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/regular-image.jpg',
              alt: 'Regular Image',
            },
          ],
        },
      ],
    };

    // Call processImages with no external patterns (empty array)
    await processImages(mockLog, tree, mockMediaHandler, baseUrl, []);

    // Verify no images are marked as external
    for (let i = 0; i < tree.children.length; i += 1) {
      const node = tree.children[i].children[0];
      assert.ok(!node.data || !node.data.externalImage, `Image ${i} should not be marked as external`);
    }

    // Verify all images are processed
    assert.strictEqual(processedUrls.length, 4, 'All 4 images should be processed');
    assert.deepStrictEqual(
      processedUrls,
      [
        'https://example.com/adobe/assets/urn:aaid:aem:12345',
        'https://dam.example.com/content/asset.jpg',
        'https://cdn.example.net/external/image.png',
        'https://example.com/regular-image.jpg',
      ],
      'All image URLs should be processed',
    );

    // Call processImages with undefined external patterns
    processedUrls = [];
    await processImages(mockLog, tree, mockMediaHandler, baseUrl);

    // Verify no images are marked as external
    for (let i = 0; i < tree.children.length; i += 1) {
      const node = tree.children[i].children[0];
      assert.ok(!node.data || !node.data.externalImage, `Image ${i} should not be marked as external with undefined patterns`);
    }

    // Verify all images are processed
    assert.strictEqual(processedUrls.length, 4, 'All 4 images should be processed with undefined patterns');
  });
});
