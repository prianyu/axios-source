'use strict';

/**
 * Throttle decorator
 * 节流函数
 * @param {Function} fn 要节流的烂熟
 * @param {Number} freq 节流频率，次/秒
 * @return {Function}
 */
function throttle(fn, freq) {
  let timestamp = 0; // 上次调用fn的时间
  const threshold = 1000 / freq; // 节流事件间隔
  let timer = null;
  return function throttled() {
    const force = this === true; // 是否强制立即执行

    const now = Date.now();
    // 强制立即执行或者距离上次调用时间已经超过了节流间隔
    if (force || now - timestamp > threshold) {
      if (timer) { // 清除定时器
        clearTimeout(timer);
        timer = null;
      }
      timestamp = now; // 更新上次调用时间
      return fn.apply(null, arguments);
    }
    // 设置定时器，在剩余时间达到后执行
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        timestamp = Date.now();
        return fn.apply(null, arguments);
      }, threshold - (now - timestamp));
    }
  };
}

export default throttle;
