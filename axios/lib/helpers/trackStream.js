
// 提供了一套用于流处理的工具，包括分块读取数据、编码数据，并追踪数据流的进度

// 将大块的数据拆分成小块的数据
// chunk： 要拆分的原始数据 
// chunkSize： 要拆分的数据块的大小
export const streamChunk = function* (chunk, chunkSize) {
  let len = chunk.byteLength; // chunk长度

  // 没有传递chunkSize，或者chunk长度小于chunkSize，直接返回整个chunk
  if (!chunkSize || len < chunkSize) {
    yield chunk;
    return;
  }

  let pos = 0;
  let end;

  // 按照指定的长度逐步生成数据块
  while (pos < len) {
    end = pos + chunkSize;
    yield chunk.slice(pos, end);
    pos = end;
  }
}

// 接收可迭代的数据流，按照指定的大小逐步生成数据块
export const readBytes = async function* (iterable, chunkSize, encode) {
  for await (const chunk of iterable) {
    yield* streamChunk(ArrayBuffer.isView(chunk) ? chunk : (await encode(String(chunk))), chunkSize);
  }
}

/**
*  跟踪流数据的处理进度，并按需处理数据。
 * @param {ReadableStream} stream - 要处理的ReadableStream对象。
 * @param {number} chunkSize - 每个数据块的大小。
 * @param {Function} onProgress - 处理进度回调函数。
 * @param {Function} onFinish - 完成处理回调函数。
 * @param {Function} encode - 将字符串编码的函数。
 * @returns {ReadableStream} - 带有进度跟踪的ReadableStream对象。
 */
export const trackStream = (stream, chunkSize, onProgress, onFinish, encode) => {
  // 创建一个readBytes迭代器
  const iterator = readBytes(stream, chunkSize, encode);

  let bytes = 0;

  return new ReadableStream({
    type: 'bytes',

    //队列不满时会重复调用该方法
    async pull(controller) {
      const { done, value } = await iterator.next(); // 获取下一块数据

      if (done) { // 已输出完成，执行完成回调
        controller.close();
        onFinish();
        return;
      }

      // 更新进度并入队数据
      // 执行进度回调
      let len = value.byteLength;
      onProgress && onProgress(bytes += len);
      controller.enqueue(new Uint8Array(value));
    },
    cancel(reason) { // 取消处理
      onFinish(reason);
      return iterator.return();
    }
  }, {
    highWaterMark: 2 // 内部队列的最大数量
  })
}
