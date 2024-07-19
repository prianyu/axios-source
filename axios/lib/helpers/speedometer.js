'use strict';

/**
 * Calculate data maxRate
 * 一个用于计算数据传输速率的函数，以每秒字节数为单位。
 * 它通过在一个环形数组中记录每一个样本数据所处的时间和数据块大小
 * 使用tail指向起步位置，head指向当前样本位置
 * 这样就可以计算出这个时间窗口的总数据量和总耗时，从而预估出一个平均传输熟虑
 * @param {Number} [samplesCount= 10] // 采样数量，表示要记录的数据块样本数
 * @param {Number} [min= 1000] 最小时间间隔，单位ms
 * @returns {Function}
 */
function speedometer(samplesCount, min) {
  samplesCount = samplesCount || 10; // 采样数量
  const bytes = new Array(samplesCount); // 存储数据块大小的数组
  const timestamps = new Array(samplesCount); // 存储时间戳的数组
  let head = 0; // 头指针，指向下一个插入位置的索引
  let tail = 0; // 尾指针，指向第一个有效数据块的索引
  let firstSampleTS; // 记录第一个样本的时间戳

  min = min !== undefined ? min : 1000; // 最小时间间隔

  // 返回用于推送数据块大小并计算速率的函数
  return function push(chunkLength) {
    const now = Date.now();

    const startedAt = timestamps[tail]; // 起步时间戳，随着tail变化，起步时间会不断更新

    // 第一个样本的时间戳
    if (!firstSampleTS) {
      firstSampleTS = now;
    }

    // 记录存储块的大小和时间戳
    bytes[head] = chunkLength;
    timestamps[head] = now;

    let i = tail;
    let bytesCount = 0;

    // 计算已记录的数据块大小总和
    while (i !== head) {
      bytesCount += bytes[i++];
      i = i % samplesCount; // 更新i
    }

    // 更新头尾指针，是一个环，超过了从第一个位置又开始记录
    head = (head + 1) % samplesCount;

    // 说明更新了一轮，需要重新计算起步时间
    if (head === tail) {
      tail = (tail + 1) % samplesCount;
    }

    // 检查是否达到最新时间间隔，这个判断可以避免初始阶段由于样本不足导致速率计算不准确的问题
    if (now - firstSampleTS < min) {
      return;
    }

    // 计算传输速率
    // 从起步时间到现在的时间间隔，即tail指针所在的样本块的时间戳到当前head所在的时间戳之间的时间间隔
    const passed = startedAt && now - startedAt;

    // 以每秒字节数为单位计算传输速率
    return passed ? Math.round(bytesCount * 1000 / passed) : undefined;
  };
}

export default speedometer;
