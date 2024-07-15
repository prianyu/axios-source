'use strict';

import utils from '../utils.js';
import parseHeaders from '../helpers/parseHeaders.js';

const $internals = Symbol('internals');

// 将去除收尾空格后转换为小写
function normalizeHeader(header) {
  return header && String(header).trim().toLowerCase();
}


// 规范化header值
function normalizeValue(value) {
  // false和null直接返回
  if (value === false || value == null) {
    return value;
  }

  // 数组则递归规范化，否则返回将其转为字符串返回
  // [1, "string", false, null] => ["1", "string", false, null]
  // [1, [2, 3], "string"] => ["1", ["2", "3"], "string"]
  return utils.isArray(value) ? value.map(normalizeValue) : String(value);
}

// 将字符串解析成键值对
function parseTokens(str) {
  const tokens = Object.create(null);
  // 匹配键值对key = value
  const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let match;

  while ((match = tokensRE.exec(str))) {
    tokens[match[1]] = match[2];
  }

  // 返回键值对
  return tokens;
}

// 是否为有效的请求头名称
const isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());

/**
 * 
 * @param {any} context 调用的上下文
 * @param {any} value header的值
 * @param {string} header  header的名称
 * @param {any} filter 匹配函数
 * @param {boolean} isHeaderNameFilter  是否应该使用头部字段的名称而非其值进行匹配
 * @returns 
 */
function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
  if (utils.isFunction(filter)) {
    // 如果是函数则返回调用后的值
    // 将header的value和key传入作为参数
    return filter.call(this, value, header);
  }

  // 使用名称进行匹配
  if (isHeaderNameFilter) {
    value = header;
  }

  // value不是字符串则返回
  if (!utils.isString(value)) return;

  // 如果value是字符串，则返回当当前的value是否包含filter
  if (utils.isString(filter)) {
    return value.indexOf(filter) !== -1;
  }


  // value是正则则返回是否匹配
  if (utils.isRegExp(filter)) {
    return filter.test(value);
  }
}

function formatHeader(header) {
  return header.trim()
    .toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str) => {
      return char.toUpperCase() + str;
    });
}

function buildAccessors(obj, header) {
  const accessorName = utils.toCamelCase(' ' + header);

  ['get', 'set', 'has'].forEach(methodName => {
    Object.defineProperty(obj, methodName + accessorName, {
      value: function (arg1, arg2, arg3) {
        return this[methodName].call(this, header, arg1, arg2, arg3);
      },
      configurable: true
    });
  });
}

class AxiosHeaders {
  constructor(headers) {
    headers && this.set(headers);
  }

  set(header, valueOrRewrite, rewrite) {
    const self = this;

    function setHeader(_value, _header, _rewrite) {
      const lHeader = normalizeHeader(_header); // 去除收尾空格并转为小写

      if (!lHeader) { // header名称不能为空
        throw new Error('header name must be a non-empty string');
      }

      const key = utils.findKey(self, lHeader); // 从当前实例中寻找header的key（不区分大小写）

      // 以下情况会设置header
      // 1. 如果实例中不存在该header
      // 2. 如果实例中该header的值为undefined
      // 3. 如果_rewrite被显式设置为true
      // 4. _rewrite未定义且当前实例中该header不为false
      if (!key || self[key] === undefined || _rewrite === true || (_rewrite === undefined && self[key] !== false)) {
        self[key || _header] = normalizeValue(_value); // 规范化后设置对应的header
      }
    }

    const setHeaders = (headers, _rewrite) =>
      utils.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));

    if (utils.isPlainObject(header) || header instanceof this.constructor) {
      // header是一个对象或者是AxiosHeaders实例，则遍历并设置header
      setHeaders(header, valueOrRewrite)
    } else if (utils.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
      // 如果header是一个字符串且名称合法，则解析成http头信息对象后设置header
      setHeaders(parseHeaders(header), valueOrRewrite);
    } else if (utils.isHeaders(header)) { // 如果是一个Headers实例(Fetch API)，则遍历并设置header
      for (const [key, value] of header.entries()) {
        setHeader(value, key, rewrite);
      }
    } else { // 其它情况直接设置
      header != null && setHeader(valueOrRewrite, header, rewrite);
    }

    // 返回当前的AxiosHeaders实例
    return this;
  }

  // 获取header
  get(header, parser) {
    header = normalizeHeader(header); // 去除收尾空格并转为小写

    if (header) {
      const key = utils.findKey(this, header); // 从当前实例查找对应的key

      if (key) {
        const value = this[key]; // 获取对应的value

        if (!parser) { // 没有传入parser则直接返回
          return value;
        }

        if (parser === true) { // parser为true则返回解析后的对象
          return parseTokens(value);
        }

        // 如果传入的parser是个函数，则调用后返回解析结果
        if (utils.isFunction(parser)) {
          return parser.call(this, value, key);
        }

        // 如果parser是正则表达式，则返回匹配结果
        if (utils.isRegExp(parser)) {
          return parser.exec(value);
        }

        // parser为其它值则抛出错误
        throw new TypeError('parser must be boolean|regexp|function');
      }
    }
  }

  // 判断header是否存在
  has(header, matcher) {
    header = normalizeHeader(header); // 去除收尾空格并转为小写

    if (header) {
      const key = utils.findKey(this, header); // 从当前实例查找对应的key

      // 存在且匹配则返回true，否则返回false
      return !!(key && this[key] !== undefined && (!matcher || matchHeaderValue(this, this[key], key, matcher)));
    }

    return false;
  }

  // 删除指定的header
  delete(header, matcher) {
    const self = this;
    let deleted = false;

    function deleteHeader(_header) {
      _header = normalizeHeader(_header); // 去除收尾空格并转为小写

      if (_header) {
        const key = utils.findKey(self, _header); // 找出key

        // 存在且匹配则删除，并标记为已删除成功
        if (key && (!matcher || matchHeaderValue(self, self[key], key, matcher))) {
          delete self[key];

          deleted = true;
        }
      }
    }

    // 是数组则遍历删除
    if (utils.isArray(header)) {
      header.forEach(deleteHeader);
    } else { // 不是数组则删除
      deleteHeader(header);
    }

    // 返回是否删除成功
    return deleted;
  }

  // 清除header
  clear(matcher) {
    const keys = Object.keys(this);
    let i = keys.length;
    let deleted = false;

    // 遍历所有的header
    while (i--) {
      const key = keys[i];

      // 如果匹配则删除（会使用键名过滤）
      if (!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
        delete this[key];
        deleted = true;
      }
    }

    // 返回是否删除成功
    return deleted;
  }

  normalize(format) {
    const self = this;
    const headers = {};

    utils.forEach(this, (value, header) => {
      const key = utils.findKey(headers, header);

      if (key) {
        self[key] = normalizeValue(value);
        delete self[header];
        return;
      }

      const normalized = format ? formatHeader(header) : String(header).trim();

      if (normalized !== header) {
        delete self[header];
      }

      self[normalized] = normalizeValue(value);

      headers[normalized] = true;
    });

    return this;
  }

  concat(...targets) {
    return this.constructor.concat(this, ...targets);
  }

  toJSON(asStrings) {
    const obj = Object.create(null);

    utils.forEach(this, (value, header) => {
      value != null && value !== false && (obj[header] = asStrings && utils.isArray(value) ? value.join(', ') : value);
    });

    return obj;
  }

  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }

  toString() {
    return Object.entries(this.toJSON()).map(([header, value]) => header + ': ' + value).join('\n');
  }

  // 添加Symbol.toStringTag属性
  get [Symbol.toStringTag]() {
    return 'AxiosHeaders';
  }

  // 添加静态方法from，根据传入的参数创建AxiosHeaders实例
  static from(thing) {
    return thing instanceof this ? thing : new this(thing);
  }

  static concat(first, ...targets) {
    const computed = new this(first);

    targets.forEach((target) => computed.set(target));

    return computed;
  }

  static accessor(header) {
    const internals = this[$internals] = (this[$internals] = {
      accessors: {}
    });

    const accessors = internals.accessors;
    const prototype = this.prototype;

    function defineAccessor(_header) {
      const lHeader = normalizeHeader(_header);

      if (!accessors[lHeader]) {
        buildAccessors(prototype, _header);
        accessors[lHeader] = true;
      }
    }

    utils.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);

    return this;
  }
}

AxiosHeaders.accessor(['Content-Type', 'Content-Length', 'Accept', 'Accept-Encoding', 'User-Agent', 'Authorization']);

// reserved names hotfix
utils.reduceDescriptors(AxiosHeaders.prototype, ({ value }, key) => {
  let mapped = key[0].toUpperCase() + key.slice(1); // map `set` => `Set`
  return {
    get: () => value,
    set(headerValue) {
      this[mapped] = headerValue;
    }
  }
});

utils.freezeMethods(AxiosHeaders);

export default AxiosHeaders;
