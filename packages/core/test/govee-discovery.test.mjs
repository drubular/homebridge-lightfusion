import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  discoverGoveeDevices,
} from '../dist/providers/govee-discovery.js';

class FakeSocket extends EventEmitter {
  close() {}

  bind() {
    queueMicrotask(() => {
      this.emit('listening');
    });
  }

  send(
    payload,
    port,
    address,
    callback,
  ) {
    assert.equal(port, 4001);
    assert.equal(
      address,
      '239.255.255.250',
    );

    const request = JSON.parse(
      payload.toString(),
    );

    assert.deepEqual(request, {
      msg: {
        cmd: 'scan',
        data: {
          account_topic: 'reserve',
        },
      },
    });

    queueMicrotask(() => {
      this.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            msg: {
              cmd: 'scan',
              data: {
                ip: '192.168.68.102',
                device: 'device-123',
                sku: 'H60A1',
              },
            },
          }),
        ),
      );

      callback(null);
    });
  }
}

test('discovers Govee devices from LAN scan responses', async () => {
  const socket = new FakeSocket();

  const devices =
    await discoverGoveeDevices(
      25,
      () => socket,
    );

  assert.deepEqual(devices, [
    {
      id: 'device-123',
      ip: '192.168.68.102',
      model: 'H60A1',
    },
  ]);
});