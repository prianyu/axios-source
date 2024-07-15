'use strict';

import utils from './../utils.js';

// RawAxiosHeaders whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
// 在node中，需要被忽略的重复设置的HTTP头部信息
const ignoreDuplicateOf = utils.toObjectSet([
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
]);

/**
 * Parse headers into an object
 * 解析原始的HTTP头字符串，并将其处理成一个对象
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} rawHeaders Headers needing to be parsed
 *
 * @returns {Object} Headers parsed into an object
 */
export default rawHeaders => {
  const parsed = {};
  let key;
  let val;
  let i;

  rawHeaders && rawHeaders.split('\n').forEach(function parser(line) {
    i = line.indexOf(':'); // 找出每一行中:的位置
    key = line.substring(0, i).trim().toLowerCase(); // 提取冒号前的部分作为键并去除空白字符然后转换为小写
    val = line.substring(i + 1).trim(); // 提取冒号后的部分作为值并去除空白字符

    // 如果键为空或该键已存在且属于需要忽略重复的字段，则跳过当前行
    if (!key || (parsed[key] && ignoreDuplicateOf[key])) {
      return;
    }

    // 如果处理的是Set-Cookie字段，则将其值添加到数组中
    if (key === 'set-cookie') {
      if (parsed[key]) {
        parsed[key].push(val);
      } else {
        parsed[key] = [val];
      }
    } else {
      // 对于其他头部字段，如果键已经存在，则用逗号加一个空格连接新旧值；否则直接设置为新值
      parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
    }
  });

  // 返回解析后的头部对象
  return parsed;
};
