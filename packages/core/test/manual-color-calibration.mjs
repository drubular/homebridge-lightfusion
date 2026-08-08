import {
  GoveeProvider,
  HueProvider,
} from '../dist/index.js';

const [
  ,
  ,
  hueBridgeIp,
  hueApplicationKey,
  goveeIp,
  hue,
] = process.argv;

if (
  !hueBridgeIp ||
  !hueApplicationKey ||
  !goveeIp ||
  hue === undefined
) {
  console.error(
    'Usage: node manual-color-calibration.mjs <hue-ip> <hue-key> <govee-ip> <hue>',
  );
  process.exit(1);
}

const hueProvider = new HueProvider({
  bridgeIp: hueBridgeIp,
  applicationKey: hueApplicationKey,
});

const goveeProvider = new GoveeProvider({
  id: 'livingroom-big-light',
  name: 'Livingroom Big Light',
  model: 'H60A1',
  ip: goveeIp,
});

const state = {
  on: true,
  brightness: 100,
  hue: Number(hue),
  saturation: 100,
};

const hueLightIds = ['3', '4', '5', '6', '7'];

console.log(`Sending HSV: ${hue}°, 100%, 100%`);

await Promise.all([
  ...hueLightIds.map(
    (lightId) => hueProvider.setState(lightId, state),
  ),
  goveeProvider.setState(
    'livingroom-big-light',
    state,
  ),
]);

console.log('Done');