'use strict';

import AxiosError from '../core/AxiosError.js';
import parseProtocol from './parseProtocol.js';
import platform from '../platform/index.js';

// 匹配data uri
// ^(?:([^;]+);)? => 匹配mimetype，如image/png
// (?:[^;]+;)? => 额外信息，如charset=utf-8
// (base64|),([\s\S]*)$ => 匹配base64编码和数据
const DATA_URL_PATTERN = /^(?:([^;]+);)?(?:[^;]+;)?(base64|),([\s\S]*)$/;

/**
 * Parse data uri to a Buffer or Blob
 * 将data uri解析成buffer或者blob
 * @param {String} uri 要解析的data uri
 * @param {?Boolean} asBlob 是否解析成blob
 * @param {?Object} options 配置选项
 * @param {?Function} options.Blob Blob构造函数
 *
 * @returns {Buffer|Blob}
 */
export default function fromDataURI(uri, asBlob, options) {
  const _Blob = options && options.Blob || platform.classes.Blob; // 获取Blob构造函数
  const protocol = parseProtocol(uri); // 从url中解析出协议

  // 解析成blob
  if (asBlob === undefined && _Blob) {
    asBlob = true;
  }

  // data:协议
  if (protocol === 'data') {
    uri = protocol.length ? uri.slice(protocol.length + 1) : uri; // 截取协议后的字符串

    const match = DATA_URL_PATTERN.exec(uri); // 匹配data uri

    // 不是一个有效的data uri
    if (!match) {
      throw new AxiosError('Invalid URL', AxiosError.ERR_INVALID_URL);
    }

    const mime = match[1]; // mimetype
    const isBase64 = match[2]; // 是否是base64编码
    const body = match[3]; // 数据
    const buffer = Buffer.from(decodeURIComponent(body), isBase64 ? 'base64' : 'utf8'); // 将数据转为buffer

    // 转为blob
    if (asBlob) {
      if (!_Blob) { // 不支持blob
        throw new AxiosError('Blob is not supported', AxiosError.ERR_NOT_SUPPORT);
      }

      return new _Blob([buffer], { type: mime });
    }

    // 不是blob，转为buffer
    return buffer;
  }

  // 非data协议
  throw new AxiosError('Unsupported protocol ' + protocol, AxiosError.ERR_NOT_SUPPORT);
}
