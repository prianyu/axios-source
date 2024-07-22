'use strict';

import isAbsoluteURL from '../helpers/isAbsoluteURL.js';
import combineURLs from '../helpers/combineURLs.js';

/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 * 根据baseURL和requestURL返回一个新的URL
 * 如果requestedURL已经是绝对URL，则直接返回requestedURL
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 *
 * @returns {string} The combined full path
 */
export default function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
}
