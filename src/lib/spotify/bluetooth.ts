import { parseHeartRate } from "./dj";

type Characteristic = EventTarget & { value?: DataView; startNotifications(): Promise<Characteristic>; stopNotifications(): Promise<Characteristic> };
type Device = EventTarget & { name?: string; gatt?: { connected: boolean; connect(): Promise<{ getPrimaryService(name: string): Promise<{ getCharacteristic(name: string): Promise<Characteristic> }> }>; disconnect(): void } };
type Bluetooth = { requestDevice(options: { filters: { services: string[] }[] }): Promise<Device> };

export function bluetoothAvailable() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator && window.isSecureContext;
}

export async function connectHeartRate(onSample: (bpm: number) => void, onDisconnect: () => void) {
  if (!bluetoothAvailable()) throw new Error("Use Chrome or Edge with Bluetooth support over HTTPS. Safari and iPhone browsers do not support this connection.");
  const bluetooth = (navigator as Navigator & { bluetooth: Bluetooth }).bluetooth;
  const device = await bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
  let characteristic: Characteristic | undefined;
  const changed = () => {
    if (!characteristic?.value) return;
    const bpm = parseHeartRate(characteristic.value);
    if (bpm !== null) onSample(bpm);
  };
  const disconnected = () => onDisconnect();
  try {
    const server = await device.gatt?.connect();
    if (!server) throw new Error("Unable to connect to the heart-rate monitor.");
    const service = await server.getPrimaryService("heart_rate");
    characteristic = await service.getCharacteristic("heart_rate_measurement");
    characteristic.addEventListener("characteristicvaluechanged", changed);
    device.addEventListener("gattserverdisconnected", disconnected);
    await characteristic.startNotifications();
  } catch (error) {
    characteristic?.removeEventListener("characteristicvaluechanged", changed);
    device.removeEventListener("gattserverdisconnected", disconnected);
    device.gatt?.disconnect();
    throw error;
  }
  return { name: device.name ?? "Heart-rate monitor", disconnect() {
    characteristic?.removeEventListener("characteristicvaluechanged", changed);
    device.removeEventListener("gattserverdisconnected", disconnected);
    void characteristic?.stopNotifications().catch(() => {});
    device.gatt?.disconnect();
  } };
}
