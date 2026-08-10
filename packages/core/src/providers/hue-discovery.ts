export interface DiscoveredHueBridge {
  id: string;
  ip: string;
  port: number;
}

interface HueDiscoveryResponse {
  id?: string;
  internalipaddress?: string;
  port?: number;
}

const HUE_DISCOVERY_URL =
  'https://discovery.meethue.com/';

export async function discoverHueBridges(): Promise<
  DiscoveredHueBridge[]
> {
  const response = await fetch(
    HUE_DISCOVERY_URL,
  );

  if (!response.ok) {
    throw new Error(
      `Hue bridge discovery failed with status ${response.status}`,
    );
  }

  const result =
    await response.json() as HueDiscoveryResponse[];

  return result
    .filter(
      (
        bridge,
      ): bridge is Required<HueDiscoveryResponse> =>
        Boolean(
          bridge.id &&
          bridge.internalipaddress &&
          bridge.port !== undefined,
        ),
    )
    .map((bridge) => ({
      id: bridge.id,
      ip: bridge.internalipaddress,
      port: bridge.port,
    }));
}