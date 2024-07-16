'use strict';

import utils from '../utils.js';
import parseHeaders from '../helpers/parseHeaders.js';

const $internals = Symbol('internals');

// 将去除收尾空格后转换为小写
function normalizeHeader(header) {
  return header && String(header).trim().toLowerCase();
}


// 规范化header的值
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

// 格式化头部名称，转为首字母大写的单词
function formatHeader(header) {
  // 去除首尾空格后转为全小写
  // 匹配每个单词的首字母，然后转为大写
  return header.trim()
    .toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str) => {
      return char.toUpperCase() + str;
    });
}
// 动态创建访问器方法（getter、setter、has）用于访问或者设置某个头
// 如getContentType,setContentType,hasContentType
function buildAccessors(obj, header) {
  // 转为驼峰命名字符串
  const accessorName = utils.toCamelCase(' ' + header);

  // 创建访问器方法
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

  // 设置header
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

  // 格式化header：名称和值都会格式化
  // 当format为true时格式化后的header名称为首字母大写，且去掉收尾的空格
  // 当format为false时，只是header名称去掉收尾空格
  // 格式化后同名的header后面的会覆盖前面的
  normalize(format) {
    const self = this;
    const headers = {};

    utils.forEach(this, (value, header) => {
      // 在格式化标记对象中查找key
      const key = utils.findKey(headers, header);

      // { "x-Custom": '222', "x-custom": '111'} =>
      // format: true => {"X-Custom": '111"}
      // format: false => {"x-Custom": '111'}
      if (key) { // 找到了说明该header已经格式化过了
        // 重新设置值
        self[key] = normalizeValue(value);
        // 删除原始header
        delete self[header];
        return;
      }

      // 格式化header名称，如果format不为false，则去除收尾空格后转为首字母大小的单词拼接
      // 否则只去除首尾的空格
      const normalized = format ? formatHeader(header) : String(header).trim();

      // 格式化后名称不一致，则删除原有的header
      if (normalized !== header) {
        delete self[header];
      }

      // 添加值和名称都格式化后的header
      self[normalized] = normalizeValue(value);
      // 标记为已格式化
      headers[normalized] = true;
    });

    return this;
  }

  // 使用静态方法，将当前实例 与传入的多个目标对象合并并返回
  concat(...targets) {
    return this.constructor.concat(this, ...targets);
  }

  // 将当前实例转换为JSON对象
  // 如果asStrings为true，则将数组类型的header值转换为逗号分隔的字符串
  // 否则直接返回数组类型的值
  toJSON(asStrings) {
    const obj = Object.create(null);

    utils.forEach(this, (value, header) => {
      value != null && value !== false && (obj[header] = asStrings && utils.isArray(value) ? value.join(', ') : value);
    });

    return obj;
  }

  // 添加Symbol.iterator属性，返回一个迭代器
  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }

  // 添加toString方法，返回对象字符串
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

  // 合并两个对象
  static concat(first, ...targets) {
    const computed = new this(first); // 创建一个新的实例

    // 遍历合并目标对象
    targets.forEach((target) => computed.set(target));

    // 返回合并后的实例
    return computed;
  }

  // 添加访问器方法
  // 在AxiosHeaders.prototype上添加以`get`,`set`,`has`开头+以驼峰命名的头部名称的访问器
  // 用于更加便捷的访问和设置响应的头部信息
  static accessor(header) {
    const internals = this[$internals] = (this[$internals] = {
      accessors: {}
    });

    const accessors = internals.accessors; // 访问器对象
    const prototype = this.prototype; // 原型

    // 用于定义访问器的函数
    function defineAccessor(_header) {
      const lHeader = normalizeHeader(_header); // 去除收尾空格并转为小写

      if (!accessors[lHeader]) { // 未定义
        buildAccessors(prototype, _header); // 在原型上添加访问器方法
        accessors[lHeader] = true;
      }
    }

    utils.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);

    // 支持链式调用
    return this;
  }
}

// 创建访问器
// 在原型上添加getContentType,setContentType,hasContentType等方法
AxiosHeaders.accessor(['Content-Type', 'Content-Length', 'Accept', 'Accept-Encoding', 'User-Agent', 'Authorization']);

// reserved names hotfix
// 解决保留关键字命名冲突的问题
// 以上AxiosHeaders.prototype上添加了一些属性描述符
// 如果被重写则可能会导致不可预期的行为，如：AxiosHeaders.prototype.getContentType = 123
// 为了避免这些行为发生，所以将这些内置的描述符以及原始的描述符作为保留关键词
// 重写其getter和setter，避免被直接修改
utils.reduceDescriptors(AxiosHeaders.prototype, ({ value }, key) => {
  // 将key映射为首字母大写的key
  let mapped = key[0].toUpperCase() + key.slice(1); // map `set` => `Set`
  return {
    get: () => value,
    set(headerValue) {
      this[mapped] = headerValue;
    }
  }
});

// 冻结AxiosHeaders的方法，将其设置成不可修改和枚举
utils.freezeMethods(AxiosHeaders);

export default AxiosHeaders;

/** 
const headers = new AxiosHeaders({ "x-Custom": '222', "x-custom": '111' })
AxiosHeaders.accessor("x-Custom") // 自定义访问器
headers.normalize(true) // 格式化
console.log(headers)
console.log(headers.hasXCustom()) // true
AxiosHeaders.prototype.getContentType = 123 // 保留关键字
console.log(headers.GetContentType) // 123
AxiosHeaders.accessor = 1235 // 方法冻结， Error

*/