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
/**
 * Renders special html only format.
 */
function format(tagName) {
  const tagOpen = `<${tagName}>`;
  const tagClose = `</${tagName}>`;

  /**
   * @param {Node} node
   * @param {Parents | undefined} _
   * @param {State} state
   * @param {Info} info
   * @returns {string}
   */
  return (node, _, state, info) => {
    const exit = state.enter('html');
    const tracker = state.createTracker(info);
    let value = tracker.move(tagOpen);
    value += tracker.move(
      state.containerPhrasing(node, {
        before: value,
        after: tagOpen,
        ...tracker.current(),
      }),
    );
    value += tracker.move(tagClose);
    exit();
    return value;
  };
}

function toMarkdown() {
  return {
    handlers: {
      subscript: format('sub'),
      superscript: format('sup'),
      underline: format('u'),
    },
  };
}

export default function formatPlugin(options) {
  const data = this.data();

  function add(field, value) {
    /* c8 ignore next 5 */
    if (data[field]) {
      data[field].push(value);
    } else {
      data[field] = [value];
    }
  }

  // add('micromarkExtensions', syntax(options));
  // add('fromMarkdownExtensions', fromMarkdown(options));
  add('toMarkdownExtensions', toMarkdown(options));
}
