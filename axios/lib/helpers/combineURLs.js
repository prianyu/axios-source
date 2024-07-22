'use strict';

/**
 * Creates a new URL by combining the specified URLs
 * 合并两个url为一个新的url
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 *
 * @returns {string} The combined URL
 */
export default function combineURLs(baseURL, relativeURL) {
  // 替换baseURL末尾的/，relativeURL头部的/，并拼接
  return relativeURL
    ? baseURL.replace(/\/?\/$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
}
