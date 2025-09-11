// WARNING: these memory streams may still open in the background, even there do not have any active
// task, IO, timers that keep the Node.js process running. So If you are trying wait for data from the stream,
// the process will exit because there is no active task.

// @ts-nocheck
import STREAM from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import { Buffer, BufferEncoding } from 'node:buffer'

export class MemoryReadableStream extends STREAM.Readable {
  constructor(data: unknown, options?: unknown) {
    super(options)
    this.init(data, options)
  }
}

export class MemoryWritableStream extends STREAM.Writable {
  constructor(data: unknown, options?: unknown) {
    super(options)
    this.init(data, options)
  }
}

export class MemoryDuplexStream extends STREAM.Duplex {
  constructor(data: unknown, options?: unknown) {
    super(options)
    this.init(data, options)
  }

  end(chunk: unknown, encoding?: BufferEncoding, cb?: () => void) {
    var self = this
    return super.end.call(this, chunk, encoding, function () {
      self.push(null) //finish readble stream too
      if (cb) cb()
    })
  }
}

MemoryReadableStream.prototype.init =
  MemoryWritableStream.prototype.init =
  MemoryDuplexStream.prototype.init =
    function init(data, options) {
      var self = this
      this.queue = []

      if (data) {
        if (!Array.isArray(data)) {
          data = [data]
        }

        data.forEach(function (chunk) {
          if (!(chunk instanceof Buffer)) {
            chunk = new Buffer(chunk)
          }
          self.queue.push(chunk)
        })
      }

      options = options || {}

      this.maxbufsize = options.hasOwnProperty('maxbufsize') ? options.maxbufsize : null
      this.bufoverflow = options.hasOwnProperty('bufoverflow') ? options.bufoverflow : null
      this.frequence = options.hasOwnProperty('frequence') ? options.frequence : null
    }

MemoryReadableStream.prototype._read = MemoryDuplexStream.prototype._read = function _read(n) {
  var self = this,
    frequence = self.frequence || 0,
    wait_data = this instanceof STREAM.Duplex && !this._writableState.finished ? true : false
  if (!this.queue.length && !wait_data) {
    this.push(null) // finish stream
  } else if (this.queue.length) {
    setTimeout(function () {
      if (self.queue.length) {
        var chunk = self.queue.shift()
        if (chunk && !self._readableState.ended) {
          if (!self.push(chunk)) {
            self.queue.unshift(chunk)
          }
        }
      }
    }, frequence)
  }
}

MemoryWritableStream.prototype._write = MemoryDuplexStream.prototype._write = function _write(
  chunk,
  encoding,
  cb,
) {
  var decoder = null
  try {
    decoder = this.decodeStrings && encoding ? new StringDecoder(encoding) : null
  } catch (err) {
    return cb(err)
  }

  var decoded_chunk = decoder ? decoder.write(chunk) : chunk,
    queue_size = this._getQueueSize(),
    chunk_size = decoded_chunk.length

  if (this.maxbufsize && queue_size + chunk_size > this.maxbufsize) {
    if (this.bufoverflow) {
      return cb('Buffer overflowed (' + this.bufoverflow + '/' + queue_size + ')')
    } else {
      return cb()
    }
  }

  if (this instanceof STREAM.Duplex) {
    while (this.queue.length) {
      this.push(this.queue.shift())
    }
    this.push(decoded_chunk)
  } else {
    this.queue.push(decoded_chunk)
  }
  cb()
}

MemoryReadableStream.prototype._getQueueSize =
  MemoryWritableStream.prototype._getQueueSize =
  MemoryDuplexStream.prototype._getQueueSize =
    function () {
      var queuesize = 0,
        i
      for (i = 0; i < this.queue.length; i++) {
        queuesize += Array.isArray(this.queue[i]) ? this.queue[i][0].length : this.queue[i].length
      }
      return queuesize
    }

MemoryWritableStream.prototype.toString =
  MemoryDuplexStream.prototype.toString =
  MemoryReadableStream.prototype.toString =
  MemoryWritableStream.prototype.getAll =
  MemoryDuplexStream.prototype.getAll =
  MemoryReadableStream.prototype.getAll =
    function () {
      var self = this,
        ret = ''
      this.queue.forEach(function (data) {
        ret += data
      })
      return ret
    }

MemoryWritableStream.prototype.toBuffer =
  MemoryDuplexStream.prototype.toBuffer =
  MemoryReadableStream.prototype.toBuffer =
    function () {
      var buffer = new Buffer(this._getQueueSize()),
        currentOffset = 0

      this.queue.forEach(function (data) {
        var data_buffer = data instanceof Buffer ? data : new Buffer(data)
        data_buffer.copy(buffer, currentOffset)
        currentOffset += data.length
      })
      return buffer
    }

export function streamToString(stream: MemoryDuplexStream) {
  const chunks: string[] = []
  return new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('error', (err) => reject(err))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}
