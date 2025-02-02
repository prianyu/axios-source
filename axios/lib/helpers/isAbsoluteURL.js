'use strict';

/**
 * Determines whether the specified URL is absolute
 * 判断一个路径是否为一个绝兑路径
 * 如果路径是以(xxxx:)?//开头的则判定为据对路径，入https://www.xxx.com/something, //www.xxx.com/something
 * @param {string} url The URL to test
 *
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
export default function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}
