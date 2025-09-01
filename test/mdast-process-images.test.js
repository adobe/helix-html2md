/*
 * Copyright 2025 Adobe. All rights reserved.
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
import { processImages, TooManyImagesError, toSISize } from '../src/mdast-process-images.js';

describe('Utils Test', () => {
  it('calculates the correct si size', () => {
    assert.strictEqual(toSISize(0), '0B');
    assert.strictEqual(toSISize(100), '100B');
    assert.strictEqual(toSISize(-100), '-100B');
    assert.strictEqual(toSISize(1024), '1.00KB');
    assert.strictEqual(toSISize(1024 + 512), '1.50KB');
    assert.strictEqual(toSISize(-1024 - 512), '-1.50KB');
    assert.strictEqual(toSISize(1024 * 1024), '1.00MB');
    assert.strictEqual(toSISize(1024 * 1024, 0), '1MB');
    assert.strictEqual(toSISize(1024 * 1024 * 1024), '1.00GB');
    assert.strictEqual(toSISize(2048 * 1024 * 1024 * 1024), '2.00TB');
    assert.strictEqual(toSISize(-2048 * 1024 * 1024 * 1024), '-2.00TB');
  });
});

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

    await processImages(mockLog, tree, mockMediaHandler, baseUrl, ['https://example.com/adobe/assets/urn:aaid:aem:']);

    // Verify external asset node is not processed and URL is preserved
    const externalAssetNode = tree.children[0].children[0];
    assert.strictEqual(externalAssetNode.url, 'https://example.com/adobe/assets/urn:aaid:aem:12345-abcde', 'External asset URL should remain unchanged');

    // Verify only the regular image was processed by mediaHandler
    assert.strictEqual(processedUrls.length, 1, 'Only regular image should be processed');
    assert.strictEqual(processedUrls[0], 'https://regular-image.com/image.jpg', 'Regular image should be processed');
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

  it('skips processing external asset images without counting them toward limit', async () => {
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

    await processImages(mockLog, tree, mockMediaHandler, baseUrl, ['https://example.com/adobe/assets/urn:aaid:aem:']);

    // Verify only regular images were processed
    assert.strictEqual(processedUrls.length, 50, 'Only regular images should be processed');

    // All processed URLs should be the regular images
    for (let i = 0; i < 50; i += 1) {
      assert.ok(processedUrls.includes(`https://example.com/regular-${i}.jpg`), `Regular image ${i} should be processed`);
    }

    // Create 200 regular images (should hit the limit)
    const regularImages = [];
    for (let i = 0; i < 200; i += 1) {
      regularImages.push({
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: `https://example.com/regular-limit-${i}.jpg`,
            alt: `Regular Image Limit ${i}`,
          },
        ],
      });
    }

    const treeLimitRegular = {
      type: 'root',
      children: regularImages,
    };

    // This should not throw with exactly 200 regular images
    await processImages(mockLog, treeLimitRegular, mockMediaHandler, baseUrl, ['https://example.com/adobe/assets/urn:aaid:aem:']);

    // But if we add external images + 200 regular images, it should also not throw
    const mixedTreeWithinLimit = {
      type: 'root',
      children: [...children, ...regularImages.slice(0, 150)],
    };

    // This should not throw because external images don't count toward the limit
    await processImages(mockLog, mixedTreeWithinLimit, mockMediaHandler, baseUrl, ['https://example.com/adobe/assets/urn:aaid:aem:']);

    // And if we add one more regular image beyond 200, it should throw
    const treeOverLimit = {
      type: 'root',
      children: [
        ...regularImages,
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/one-too-many.jpg',
              alt: 'One Too Many',
            },
          ],
        },
      ],
    };

    // This should throw an error because we now have 201 regular images
    await assert.rejects(
      async () => processImages(mockLog, treeOverLimit, mockMediaHandler, baseUrl, ['https://example.com/adobe/assets/urn:aaid:aem:']),
      (err) => {
        assert.ok(err instanceof TooManyImagesError);
        assert.ok(err.message.includes('maximum number of images reached'));
        return true;
      },
    );
  });

  it('handles multiple external image patterns', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/adobe/assets/urn:aaid:aem:12345',
              alt: 'External Asset 1',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/adobe/dam/123456',
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

    await processImages(mockLog, tree, mockMediaHandler, baseUrl, [
      'https://example.com/adobe/assets/urn:aaid:aem:',
      'https://example.com/adobe/dam/',
    ]);

    // Verify all external images URLs remain unchanged
    const aemNode = tree.children[0].children[0];
    const damNode = tree.children[1].children[0];

    // Check URLs remain unchanged for external images
    assert.strictEqual(aemNode.url, 'https://example.com/adobe/assets/urn:aaid:aem:12345');
    assert.strictEqual(damNode.url, 'https://example.com/adobe/dam/123456');

    // Verify only the regular image was processed
    assert.strictEqual(processedUrls.length, 1, 'Only regular image should be processed');
    assert.strictEqual(processedUrls[0], 'https://regular-image.com/image.jpg');
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

  it('handles scene7 external asset URL patterns', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/is/image/mycompany/product123',
              alt: 'Image Server Asset',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/is/content/mycompany/product456.jpg',
              alt: 'Content Server Asset',
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

    await processImages(mockLog, tree, mockMediaHandler, baseUrl, ['https://example.com/is/image/', 'https://example.com/is/content/']);

    // Verify external asset nodes are not processed and URLs are preserved
    const imageNode = tree.children[0].children[0];
    const contentNode = tree.children[1].children[0];

    assert.strictEqual(imageNode.url, 'https://example.com/is/image/mycompany/product123', 'Image URL should remain unchanged');
    assert.strictEqual(contentNode.url, 'https://example.com/is/content/mycompany/product456.jpg', 'Content URL should remain unchanged');

    // Verify only the regular image was processed by mediaHandler
    assert.strictEqual(processedUrls.length, 1, 'Only regular image should be processed');
    assert.strictEqual(processedUrls[0], 'https://regular-image.com/image.jpg', 'Regular image should be processed');
  });

  it('handles non-array externalImageUrlPrefixes by converting it to an array', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/adobe/assets/urn:aaid:aem:12345',
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

    // Pass a string instead of an array for externalImageUrlPrefixes
    const stringPrefix = 'https://example.com/adobe/assets/urn:aaid:aem:';
    await processImages(mockLog, tree, mockMediaHandler, baseUrl, stringPrefix);

    // Verify the external asset node is not processed and URL is preserved
    const externalAssetNode = tree.children[0].children[0];
    assert.strictEqual(externalAssetNode.url, 'https://example.com/adobe/assets/urn:aaid:aem:12345', 'External asset URL should remain unchanged when prefix is a string');

    // Verify only the regular image was processed
    assert.strictEqual(processedUrls.length, 1, 'Only regular image should be processed');
    assert.strictEqual(processedUrls[0], 'https://regular-image.com/image.jpg', 'Regular image should be processed');
  });

  it('handles empty string in externalImageUrlPrefixes without errors', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/adobe/assets/urn:aaid:aem:12345',
              alt: 'External Asset',
            },
          ],
        },
      ],
    };

    // Pass an empty string for externalImageUrlPrefixes
    await processImages(mockLog, tree, mockMediaHandler, baseUrl, '');

    // An empty string will be converted to an array with an empty string
    // Images with URLs that start with an empty string (all URLs do) will be considered external
    // So no images should be processed
    assert.strictEqual(processedUrls.length, 0, 'No images should be processed with empty string prefix');
  });

  it('handles null or undefined externalImageUrlPrefixes correctly', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/image1.jpg',
              alt: 'Image 1',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/image2.jpg',
              alt: 'Image 2',
            },
          ],
        },
      ],
    };

    // Reset processedUrls
    processedUrls = [];

    // Pass null for externalImageUrlPrefixes
    await processImages(mockLog, tree, mockMediaHandler, baseUrl, null);

    // All images should be processed when null is passed
    assert.strictEqual(processedUrls.length, 2, 'All images should be processed with null prefix');
    assert.ok(processedUrls.includes('https://example.com/image1.jpg'), 'First image should be processed');
    assert.ok(processedUrls.includes('https://example.com/image2.jpg'), 'Second image should be processed');

    // Reset processedUrls for undefined test
    processedUrls = [];

    // Pass undefined for externalImageUrlPrefixes (by not passing the parameter)
    await processImages(mockLog, tree, mockMediaHandler, baseUrl);

    // All images should be processed when undefined is passed
    assert.strictEqual(processedUrls.length, 2, 'All images should be processed with undefined prefix');
    assert.ok(processedUrls.includes('https://example.com/image1.jpg'), 'First image should be processed');
    assert.ok(processedUrls.includes('https://example.com/image2.jpg'), 'Second image should be processed');
  });
});
