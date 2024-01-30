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
import { visit } from 'unist-util-visit';
import { getAllForms } from '@aemforms/forms-importer';

export async function getForms(html, options) {
  const formNameDefMap = {};
  try {
    const forms = await getAllForms(html, options);
    forms?.forEach((form) => {
      formNameDefMap[form.name] = form;
    });
  } catch (e) { /* empty */ }
  return formNameDefMap;
}

export function processForms(tree, formNameDefMap) {
  visit(tree, 'element', (node) => {
    if (node.tagName === 'form') {
      const name = node?.properties?.id || node?.properties?.name;
      const formDef = formNameDefMap[name];
      if (formDef) {
        node.tagName = 'block';
        node.properties = {};
        node.children = [
          {
            type: 'element',
            tagName: 'tr',
            children: [{
              type: 'element',
              tagName: 'td',
              children: [{
                type: 'element',
                tagName: 'pre',
                children: [{
                  type: 'text',
                  tagName: 'code',
                  value: JSON.stringify(formDef),
                }],
              }],
            }],
          },
        ];
        node.data = {
          type: 'Form',
        };
      }
    }
  });
}
