import dgram from 'node:dgram';
import { Buffer } from 'node:buffer';

export interface DiscoveredGoveeDevice {
    id: string;
    ip: string;
    model: string;
}

interface GoveeScanResponse {
    msg?: {
        cmd?: string;
        data?: {
            ip?: string;
            device?: string;
            sku?: string;
        };
    };
}

const GOVEE_MULTICAST_ADDRESS = '239.255.255.250';
const GOVEE_SCAN_PORT = 4001;
const GOVEE_RESPONSE_PORT = 4002;

export async function discoverGoveeDevices(
    timeoutMs = 2000,
    createSocket: typeof dgram.createSocket =
        dgram.createSocket,
): Promise<DiscoveredGoveeDevice[]> {
    return await new Promise((resolve, reject) => {
        const socket = createSocket({
            type: 'udp4',
            reuseAddr: true,
        });

        const devices = new Map<
            string,
            DiscoveredGoveeDevice
        >();

        const finish = (): void => {
            socket.close();
            resolve([...devices.values()]);
        };

        const timeout = setTimeout(
            finish,
            timeoutMs,
        );

        socket.on('error', (error) => {
            clearTimeout(timeout);
            socket.close();
            reject(error);
        });

        socket.on('message', (message) => {
            try {
                const response =
                    JSON.parse(
                        message.toString(),
                    ) as GoveeScanResponse;

                if (response.msg?.cmd !== 'scan') {
                    return;
                }

                const data = response.msg.data;

                if (
                    !data?.ip ||
                    !data.device ||
                    !data.sku
                ) {
                    return;
                }

                devices.set(data.device, {
                    id: data.device,
                    ip: data.ip,
                    model: data.sku,
                });
            } catch {
                // Ignore malformed/non-Govee UDP packets.
            }
        });

        socket.once('listening', () => {
            const payload = Buffer.from(
                JSON.stringify({
                    msg: {
                        cmd: 'scan',
                        data: {
                            account_topic: 'reserve',
                        },
                    },
                }),
            );

            socket.send(
                payload,
                GOVEE_SCAN_PORT,
                GOVEE_MULTICAST_ADDRESS,
                (error: Error | null) => {
                    if (error) {
                        clearTimeout(timeout);
                        socket.close();
                        reject(error);
                    }
                },
            );
        });

        socket.bind({
            port: GOVEE_RESPONSE_PORT,
            address: '0.0.0.0',
            exclusive: false,
        });
    });
}