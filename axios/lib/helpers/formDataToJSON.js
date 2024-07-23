'use strict';

import utils from '../utils.js';

/**
 * It takes a string like `foo[x][y][z]` and returns an array like `['foo', 'x', 'y', 'z']
 * 将一个属性路径解析成一个数组，数组中的每个元素是路径的一部分
 * @param {string} name - The name of the property to get. 路径字符串
 *
 * @returns An array of strings.
 */
function parsePropPath(name) {
  // foo[x][y][z] =>[['foo', undefined], ["[x]", 'x'], ["[y]", 'y'], ["[z]", 'z']] => ['foo', 'x', 'y', 'z']
  // foo.x.y.z => [['foo', undefined], ['x', undefined], ['y', undefined], ['z', undefined]] => ['foo', 'x', 'y', 'z']
  // foo-x-y-z => 同foo.x.y.z
  // foo x y z => 同foo.x.y.z
  // foo[] => [['foo', undefined], ['[]', undefined]] => ['foo', '']
  // 匹配字母数字下划线以及方括号中的字母数字下划线
  return utils.matchAll(/\w+|\[(\w*)]/g, name).map(match => {
    return match[0] === '[]' ? '' : match[1] || match[0];
  });
}

/**
 * Convert an array to an object.
 * 数组转为对象
 * @param {Array<any>} arr - The array to convert to an object.
 *
 * @returns An object with the same keys and values as the array.
 */
/**
 =>
function arrayToObject(arr) {
  return arr.reduce((obj, item, index) => {
    obj[index] = item;
    return obj;
  }, {});
}
*/
function arrayToObject(arr) {
  const obj = {};
  const keys = Object.keys(arr);
  let i;
  const len = keys.length;
  let key;
  for (i = 0; i < len; i++) {
    key = keys[i];
    obj[key] = arr[key];
  }
  return obj;
}

/**
 * It takes a FormData object and returns a JavaScript object
 * 将formData转为json
 * @param {string} formData The FormData object to convert to JSON.
 *
 * @returns {Object<string, any> | null} The converted object.
 */
function formDataToJSON(formData) {
  // 递归构建目标对象
  // 路径数组，设置的值，目标对象，当前路径的索引
  function buildPath(path, value, target, index) {
    let name = path[index++]; // 当前的属性名

    if (name === '__proto__') return true; // __proto__不处理

    const isNumericKey = Number.isFinite(+name); // 是否为数字
    const isLast = index >= path.length; // 是否为最后一段路径
    // 当name是空字符串且目标对象是数组时，将name设置为数组的长度，相当于在数组末尾添加新元素
    name = !name && utils.isArray(target) ? target.length : name;

    // 最终节点处理
    // 如果当前是最后一段路径
    if (isLast) {
      if (utils.hasOwnProp(target, name)) {
        // 如果目标对象已有该属性，则将属性值设置为数组，并将新值添加到数组中
        target[name] = [target[name], value];
      } else { // 否则直接设置属性值
        target[name] = value;
      }

      // 不是数字类型的键则返回true
      return !isNumericKey;
    }

    // 中间节点处理
    // 如果目标对象中不存在该属性，或者该属性值不是对象，则将其初始化为一个数组
    // 使用数组可以更灵活的处理动态属性
    if (!target[name] || !utils.isObject(target[name])) {
      target[name] = [];
    }

    // 递归调用，对剩余的路径进行处理
    const result = buildPath(path, value, target[name], index);

    // 返回的是非数字，则将数组转为对象
    if (result && utils.isArray(target[name])) {
      target[name] = arrayToObject(target[name]);
    }
    // 如果不是数字键返回true
    return !isNumericKey;
  }

  if (utils.isFormData(formData) && utils.isFunction(formData.entries)) {
    const obj = {};
    // 遍历对象，将属性解析成路径数组后传入buildPath构建目标对象
    utils.forEachEntry(formData, (name, value) => {
      buildPath(parsePropPath(name), value, obj, 0);
    });

    return obj;
  }

  return null;
}

export default formDataToJSON;
