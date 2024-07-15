'use strict';

// 判断给定的value是否有__CANCEL__属性
export default function isCancel(value) {
  return !!(value && value.__CANCEL__);
}
