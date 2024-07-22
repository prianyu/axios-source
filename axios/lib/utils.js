'use strict';

import bind from './helpers/bind.js';

// utils is a library of generic helper functions non-specific to axios

const { toString } = Object.prototype;
const { getPrototypeOf } = Object;

// 获取thing的类型，该函数具有缓存功能
// 通过val的toString的结果截取其类型值
const kindOf = (cache => thing => {
  const str = toString.call(thing);
  return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));

// 根据传入的类型返回用于判断输入的参数是否为指定类型的函数
const kindOfTest = (type) => {
  type = type.toLowerCase();
  return (thing) => kindOf(thing) === type
}

const typeOfTest = type => thing => typeof thing === type;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 *
 * @returns {boolean} True if value is an Array, otherwise false
 */
const { isArray } = Array;

/**
 * Determine if a value is undefined
 * 是否为undefined
 * @param {*} val The value to test
 *
 * @returns {boolean} True if the value is undefined, otherwise false
 */
const isUndefined = typeOfTest('undefined');

/**
 * Determine if a value is a Buffer
 * 检测Buffer类型
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
    && isFunction(val.constructor.isBuffer) && val.constructor.isBuffer(val);
}

/**
 * Determine if a value is an ArrayBuffer
 * 检测ArrayBuffer类型
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
const isArrayBuffer = kindOfTest('ArrayBuffer');


/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  let result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (isArrayBuffer(val.buffer));
  }
  return result;
}

/**
 * Determine if a value is a String
 * 检测String类型
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a String, otherwise false
 */
const isString = typeOfTest('string');

/**
 * Determine if a value is a Function
 * 检测函数类型
 * @param {*} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
const isFunction = typeOfTest('function');

/**
 * Determine if a value is a Number
 * 检测数字类型
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Number, otherwise false
 */
const isNumber = typeOfTest('number');

/**
 * Determine if a value is an Object
 * 检测是否为对象
 * @param {*} thing The value to test
 *
 * @returns {boolean} True if value is an Object, otherwise false
 */
const isObject = (thing) => thing !== null && typeof thing === 'object';

/**
 * Determine if a value is a Boolean
 * 检测布尔类型
 * @param {*} thing The value to test
 * @returns {boolean} True if value is a Boolean, otherwise false
 */
const isBoolean = thing => thing === true || thing === false;

/**
 * Determine if a value is a plain Object
 * 判断val是否为普通对象
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a plain Object, otherwise false
 */
const isPlainObject = (val) => {
  if (kindOf(val) !== 'object') {
    return false;
  }

  const prototype = getPrototypeOf(val);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in val) && !(Symbol.iterator in val);
}

/**
 * Determine if a value is a Date
 * 检测Date类型
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Date, otherwise false
 */
const isDate = kindOfTest('Date');

/**
 * Determine if a value is a File
 * 检测File类型
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a File, otherwise false
 */
const isFile = kindOfTest('File');

/**
 * Determine if a value is a Blob
 * 检测是否为Blob类型
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Blob, otherwise false
 */
const isBlob = kindOfTest('Blob');

/**
 * Determine if a value is a FileList
 * 检查是否为fileList
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a File, otherwise false
 */
const isFileList = kindOfTest('FileList');

/**
 * Determine if a value is a Stream
 * 检测是否为Stream类型
 * 函数有pipe方法认为是Stream
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Stream, otherwise false
 */
const isStream = (val) => isObject(val) && isFunction(val.pipe);

/**
 * Determine if a value is a FormData
 * 检查是否为FormData
 *
 * @param {*} thing The value to test
 *
 * @returns {boolean} True if value is an FormData, otherwise false
 */
const isFormData = (thing) => {
  let kind;
  return thing && (
    (typeof FormData === 'function' && thing instanceof FormData) || (
      isFunction(thing.append) && (
        (kind = kindOf(thing)) === 'formdata' ||
        // detect form-data instance
        (kind === 'object' && isFunction(thing.toString) && thing.toString() === '[object FormData]')
      )
    )
  )
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
const isURLSearchParams = kindOfTest('URLSearchParams');

// 定义分别用于判断某个值是否为ReadableStream、Request、Response、Headers的函数(Fetch API)
const [isReadableStream, isRequest, isResponse, isHeaders] = ['ReadableStream', 'Request', 'Response', 'Headers'].map(kindOfTest);

/**
 * Trim excess whitespace off the beginning and end of a string
 * 去除字符串首尾的空白字符
 * 如果字符串对象有trim方法，直接使用；否则，使用正则表达式替换开头和结尾的空白字符。
 * 检查trim方法存在的原因是为了兼容旧版本JavaScript或可能不支持String.prototype.trim方法的环境。
 * 
 * @param {String} str 需要去除空白字符的字符串
 * @returns {String} 去除首尾空白字符后的字符串
 */
const trim = (str) => str.trim ?
  str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');

/**
 * 用于遍历对象或者数组并执行指定回调的函数
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 *
 * @param {Boolean} [allOwnKeys = false]
 * @returns {any}
 */
function forEach(obj, fn, { allOwnKeys = false } = {}) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  let i;
  let l;

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    // 根据allOwnKeys决定是否返回包含不可枚举的属性
    const keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
    const len = keys.length;
    let key;

    for (i = 0; i < len; i++) {
      key = keys[i];
      fn.call(null, obj[key], key, obj);
    }
  }
}

// 不区分大小写，从对象中查找需要的key
function findKey(obj, key) {
  key = key.toLowerCase(); // 转小写
  const keys = Object.keys(obj); // 获取所有的key
  let i = keys.length;
  let _key;
  while (i-- > 0) { // 遍历，如果转为小写后相等则返回key
    _key = keys[i];
    if (key === _key.toLowerCase()) {
      return _key;
    }
  }
  return null;
}

// 全局对象
const _global = (() => {
  /*eslint no-undef:0*/
  if (typeof globalThis !== "undefined") return globalThis;
  return typeof self !== "undefined" ? self : (typeof window !== 'undefined' ? window : global)
})();

// 给定的上下文是否被定义且不等于全局对象
const isContextDefined = (context) => !isUndefined(context) && context !== _global;

/**
 * 合并多个对象到一个对象中
 * 同名key会被后面的覆盖
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 *
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  // 是否不区分大小写
  const { caseless } = isContextDefined(this) && this || {};
  const result = {};
  const assignValue = (val, key) => {
    // 根据是否区分大小写确定要合并的key
    const targetKey = caseless && findKey(result, key) || key;
    if (isPlainObject(result[targetKey]) && isPlainObject(val)) {
      // 如果两个值都是对象则递归合并
      result[targetKey] = merge(result[targetKey], val);
    } else if (isPlainObject(val)) { // 如果后面的值是对象则创建一个新对象
      result[targetKey] = merge({}, val);
    } else if (isArray(val)) { // 如果是数组则创建其副本
      result[targetKey] = val.slice();
    } else { // 否则直接赋值
      result[targetKey] = val;
    }
  }

  // 遍历所有的参数后合并
  for (let i = 0, l = arguments.length; i < l; i++) {
    arguments[i] && forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 * 将b的属性合并到a中
 *
 * @param {Object} a The object to be extended 目标对象
 * @param {Object} b The object to copy properties from 复制属性的来源对象
 * @param {Object} thisArg The object to bind function to 函数的this指向
 *
 * @param {Boolean} [allOwnKeys] 是否包含不可枚举的属性
 * @returns {Object} The resulting value of object a
 */
const extend = (a, b, thisArg, { allOwnKeys } = {}) => {
  forEach(b, (val, key) => {
    // 指定了this且值函数则以this执行该函数作为结果值
    if (thisArg && isFunction(val)) {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  }, { allOwnKeys });
  return a;
}

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 * 移除BOM头
 * @param {string} content with BOM
 *
 * @returns {string} content value without BOM
 */
const stripBOM = (content) => {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

/**
 * Inherit the prototype methods from one constructor into another
 * 实现类的继承
 * 该函数用于设置一个类（constructor）继承自另一个类（superConstructor），并可以额外添加属性（props）和描述符（descriptors）。
 * @param {Function} constructor - 要继承的子类构造函数。
 * @param {Function} superConstructor - 要继承的父类构造函数。
 * @param {Object} [props] - 可选参数，子类原型上要添加的属性对象。
 * @param {Object} [descriptors] - 可选参数，子类原型上要添加的属性描述符对象。
 */
const inherits = (constructor, superConstructor, props, descriptors) => {
  // 通过Object.create实现继承，设置constructor的原型为superConstructor的原型对象，以实现继承。
  constructor.prototype = Object.create(superConstructor.prototype, descriptors);
  // 确保constructor的prototype.constructor指向constructor本身，以保持构造函数的链。
  constructor.prototype.constructor = constructor;
  // 添加一个名为'super'的属性到constructor上，指向父类的原型对象，以便在子类中能够访问父类的方法。
  Object.defineProperty(constructor, 'super', {
    value: superConstructor.prototype
  });
  // 如果props存在，则将其属性合并到constructor的原型对象上，以添加子类自己的属性。
  props && Object.assign(constructor.prototype, props);
}

/**
 * Resolve object with deep prototype chain to a flat object
 * 将源对象的属性以及原型链上的属性平铺到目标对象上
 * 支持通过过滤器函数来控制哪些属性应该被合并
 * @param {Object} sourceObj source object 源对象
 * @param {Object} [destObj] 目标对象，属性会被合并到该对象上
 * @param {Function|Boolean} [filter] 是否复制原型链上的属性，false为不复制
 * @param {Function} [propFilter] 可选的过滤器函数，用于筛选要合并的对象，返回true则表示该属性可以被合并
 *
 * @returns {Object}
 */
const toFlatObject = (sourceObj, destObj, filter, propFilter) => {
  let props;
  let i;
  let prop;
  const merged = {};

  destObj = destObj || {};
  // eslint-disable-next-line no-eq-null,eqeqeq
  if (sourceObj == null) return destObj;

  do {
    props = Object.getOwnPropertyNames(sourceObj);
    i = props.length;
    while (i-- > 0) {
      prop = props[i];
      // 没有定义propFilter或者propFilter通过且为合并
      // 则将sourceObj[prop]复制到destObj
      if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
        destObj[prop] = sourceObj[prop];
        merged[prop] = true; // 标记为已合并
      }
    }
    // filter不为false，则获取链上的下一个对象继续合并
    sourceObj = filter !== false && getPrototypeOf(sourceObj);
  } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);

  return destObj;
}

/**
 *  Determines whether a string ends with the characters of a specified string
 * 检查字符串是否以指定的子字符串结尾。 * 
 * @param {string} str 原始字符串。
 * @param {string} searchString 要查找的子字符串。
 * @param {number} position 可选参数，指定要检查的结束位置。
 * @returns {boolean} 如果原始字符串以子字符串结尾，则返回true；否则返回false。
 */
const endsWith = (str, searchString, position) => {
  // 将输入的参数转换为字符串，确保类型一致性
  str = String(str);

  // 如果未指定位置或指定位置超出了字符串长度，则将位置设置为字符串的末尾
  if (position === undefined || position > str.length) {
    position = str.length;
  }

  // 调整位置参数，使其相对于子字符串的长度
  position -= searchString.length;

  // 从调整后的位置开始查找子字符串在原始字符串中的最后出现位置
  const lastIndex = str.indexOf(searchString, position);

  // 返回布尔值，表示子字符串是否出现在指定位置，从而确定原始字符串是否以子字符串结尾
  return lastIndex !== -1 && lastIndex === position;
}


/**
 * Returns new array from array like object or null if failed
 * 将一个array-like对象转为数组，转换失败则返回null
 *
 * @param {*} [thing]
 *
 * @returns {?Array}
 */
const toArray = (thing) => {
  if (!thing) return null; // 空值直接返回null
  if (isArray(thing)) return thing; // 数组直接返回数组
  let i = thing.length;
  if (!isNumber(i)) return null; // 没有length属性则不是array-like，返回null
  // array-like
  const arr = new Array(i); // 创建新数组
  // 遍历array-like转为数组元素
  while (i-- > 0) {
    arr[i] = thing[i];
  }
  return arr;
}

/**
 * Checking if the Uint8Array exists and if it does, it returns a function that checks if the
 * thing passed in is an instance of Uint8Array
 *
 * @param {TypedArray}
 *
 * @returns {Array}
 */
// eslint-disable-next-line func-names
/**
 * 判断一个对象是否为指定类型的TypedArray。
 * 
 * 该函数通过检查对象是否是TypedArray的实例来确定它是否为TypedArray。
 * 它使用了函数柯里化的技术，首先接受一个TypedArray的构造函数的原型作为参数，
 * 然后返回一个函数，这个函数接受一个对象作为参数，并判断该对象是否是传入的TypedArray构造函数的实例。
 * 这种做法允许在不同的环境中灵活地判断不同类型的TypedArray，比如在浏览器和Node.js中。
 * 
 * @param {Object} TypedArrayPrototype - TypedArray构造函数的原型对象。
 * @returns {Function} - 返回一个函数，用于判断传入的对象是否为指定类型的TypedArray实例。
 */
const isTypedArray = (TypedArray => {
  // 返回一个函数，该函数接受一个对象作为参数
  // eslint-disable-next-line func-names
  return thing => {
    // 判断传入的对象是否为TypedArray构造函数的实例
    return TypedArray && thing instanceof TypedArray;
  };
})(typeof Uint8Array !== 'undefined' && getPrototypeOf(Uint8Array));

/**
 * For each entry in the object, call the function with the key and value.
 *
 * @param {Object<any, any>} obj - The object to iterate over.
 * @param {Function} fn - The function to call for each entry.
 *
 * @returns {void}
 */
const forEachEntry = (obj, fn) => {
  const generator = obj && obj[Symbol.iterator];

  const iterator = generator.call(obj);

  let result;

  while ((result = iterator.next()) && !result.done) {
    const pair = result.value;
    fn.call(obj, pair[0], pair[1]);
  }
}

/**
 * It takes a regular expression and a string, and returns an array of all the matches
 *
 * @param {string} regExp - The regular expression to match against.
 * @param {string} str - The string to search.
 *
 * @returns {Array<boolean>}
 */
const matchAll = (regExp, str) => {
  let matches;
  const arr = [];

  while ((matches = regExp.exec(str)) !== null) {
    arr.push(matches);
  }

  return arr;
}

/* Checking if the kindOfTest function returns true when passed an HTMLFormElement. */
const isHTMLForm = kindOfTest('HTMLFormElement'); // 是否为form标签

// 转为驼峰命名的字符串
const toCamelCase = str => {
  // 匹配-_和空格开头的字符，去掉-_和空格，然后把第一个字母大写，其他字母保留
  return str.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g,
    function replacer(m, p1, p2) {
      return p1.toUpperCase() + p2;
    }
  );
};

/* Creating a function that will check if an object has a property. */
/**
 * 创建一个名为hasOwnProperty的函数，该函数用于检查一个对象是否具有指定的属性。
 * 这个函数封装了Object.prototype.hasOwnProperty方法，以避免在使用时出现任何潜在的原型链污染问题。
 * 
 * @param {Object} obj - 要检查的对象。
 * @param {string} prop - 要检查的属性名称。
 * @returns {boolean} 如果对象具有指定的属性，则返回true；否则返回false。
 */
const hasOwnProperty = (({ hasOwnProperty }) => (obj, prop) => hasOwnProperty.call(obj, prop))(Object.prototype);

/**
 * Determine if a value is a RegExp object
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a RegExp object, otherwise false
 */
const isRegExp = kindOfTest('RegExp');

// 遍历对象的所有属性描述符，根据提供的reducer来修改这些描述符
// 并重新定义到原对象上
const reduceDescriptors = (obj, reducer) => {
  const descriptors = Object.getOwnPropertyDescriptors(obj); // 获取属性描述符
  const reducedDescriptors = {};

  forEach(descriptors, (descriptor, name) => {
    let ret;
    if ((ret = reducer(descriptor, name, obj)) !== false) { // 使用回调函数处理描述符
      // 如果执行结果不为false，则使用新的描述符，否则使用原始的描述符
      reducedDescriptors[name] = ret || descriptor;
    }
  });

  // 重新定义属性描述符
  Object.defineProperties(obj, reducedDescriptors);
}

/**
 * Makes all methods read-only
 * 冻结对象的方法，使其变成只读且不可枚举
 * @param {Object} obj
 */

const freezeMethods = (obj) => {
  reduceDescriptors(obj, (descriptor, name) => {
    // skip restricted props in strict mode
    // 跳过严格模式下受限制的属性
    if (isFunction(obj) && ['arguments', 'caller', 'callee'].indexOf(name) !== -1) {
      return false;
    }

    const value = obj[name];

    if (!isFunction(value)) return; // 非方法

    descriptor.enumerable = false; // 设置成不可枚举

    if ('writable' in descriptor) { // 设置成不可写
      descriptor.writable = false;
      return;
    }

    // 没有定义setter时，对其设置则抛出错误
    if (!descriptor.set) {
      descriptor.set = () => {
        throw Error('Can not rewrite read-only method \'' + name + '\'');
      };
    }
  });
}

/**
 * 将数组或字符串转换为对象集合。
 * 
 * 该函数的目的是通过给定的参数（数组或字符串）和分隔符，创建一个对象，
 * 对象的属性由数组元素或字符串分割后的值组成，属性值均为true。
 * 这种转换有助于快速检查某个元素是否存在于原始数组或字符串中，通过对象的属性访问方式。
 * 
 * @param {Array|string} arrayOrString - 要转换的数组或字符串。
 * @param {string} delimiter - 如果参数是字符串，则使用此分隔符将字符串分割成数组。
 * @returns {Object} - 返回一个对象，其中属性由数组元素或字符串分割后的值组成。
 */
const toObjectSet = (arrayOrString, delimiter) => {
  const obj = {};

  const define = (arr) => {
    arr.forEach(value => {
      obj[value] = true;
    });
  }

  isArray(arrayOrString) ? define(arrayOrString) : define(String(arrayOrString).split(delimiter));

  return obj;
}

// 空函数
const noop = () => { }

// 将value转为有限的数字
const toFiniteNumber = (value, defaultValue) => {
  // 转为数字后如果有限则直接返回，否则返回默认值
  return value != null && Number.isFinite(value = +value) ? value : defaultValue;
}

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'

const DIGIT = '0123456789';

const ALPHABET = {
  DIGIT,
  ALPHA,
  ALPHA_DIGIT: ALPHA + ALPHA.toUpperCase() + DIGIT
}

// 根据指定的字符集，生成指定长度的随机字符串
const generateString = (size = 16, alphabet = ALPHABET.ALPHA_DIGIT) => {
  let str = '';
  const { length } = alphabet;
  while (size--) {
    str += alphabet[Math.random() * length | 0]
  }

  return str;
}

/**
 * If the thing is a FormData object, return true, otherwise return false.
 *  用于检查一个对象是否符合规范的 FormData 对象
 * 具有append方法、Symbol.toStringTag为FormData，且部署了Symbol.iterator
 * 比如form-data库
 *
 * @param {unknown} thing - The thing to check.
 *
 * @returns {boolean}
 */
function isSpecCompliantForm(thing) {
  return !!(thing && isFunction(thing.append) && thing[Symbol.toStringTag] === 'FormData' && thing[Symbol.iterator]);
}

// 将对象转为JSON形式的等价物
const toJSONObject = (obj) => {
  const stack = new Array(10); // 用于检测循环引用的堆栈

  const visit = (source, i) => {

    if (isObject(source)) { // 是否为对象
      if (stack.indexOf(source) >= 0) { // 检测循环引用
        return;
      }

      if (!('toJSON' in source)) { // 对象有自定义的toJSON方法
        stack[i] = source; // 对象入栈
        const target = isArray(source) ? [] : {}; // 根据source的类型初始化target

        forEach(source, (value, key) => {
          const reducedValue = visit(value, i + 1); // 递归调用visit
          // 如果reducedValue不为undefined，将其结果赋值给target对应的属性
          !isUndefined(reducedValue) && (target[key] = reducedValue);
        });

        stack[i] = undefined; // 出栈

        return target; // 返回目标对象
      }
    }
    // 不是对象或者具有toJSON方法，则直接返回
    return source;
  }

  return visit(obj, 0);
}

// 是否为async函数
const isAsyncFn = kindOfTest('AsyncFunction');

// 是否为thenable对象
const isThenable = (thing) =>
  thing && (isObject(thing) || isFunction(thing)) && isFunction(thing.then) && isFunction(thing.catch);

export default {
  isArray,
  isArrayBuffer,
  isBuffer,
  isFormData,
  isArrayBufferView,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isPlainObject,
  isReadableStream,
  isRequest,
  isResponse,
  isHeaders,
  isUndefined,
  isDate,
  isFile,
  isBlob,
  isRegExp,
  isFunction,
  isStream,
  isURLSearchParams,
  isTypedArray,
  isFileList,
  forEach,
  merge,
  extend,
  trim,
  stripBOM,
  inherits,
  toFlatObject,
  kindOf,
  kindOfTest,
  endsWith,
  toArray,
  forEachEntry,
  matchAll,
  isHTMLForm,
  hasOwnProperty,
  hasOwnProp: hasOwnProperty, // an alias to avoid ESLint no-prototype-builtins detection
  reduceDescriptors,
  freezeMethods,
  toObjectSet,
  toCamelCase,
  noop,
  toFiniteNumber,
  findKey,
  global: _global,
  isContextDefined,
  ALPHABET,
  generateString,
  isSpecCompliantForm,
  toJSONObject,
  isAsyncFn,
  isThenable
};
