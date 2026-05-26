#include <WiFi.h>
#include <WiFiClient.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <time.h>

// Wi-Fi credentials
const char* ssid = "TECNO";
const char* password = "12345678";

// Backend endpoint (adjust host and port if needed)
const char* serverHost = "10.33.9.63";
const uint16_t serverPort = 5000;
const char* serverPath = "/api/ble/upload";

// Identify this ESP32 instance by room name
const char* roomName = "room1"; // change to room2, room3, etc. for other devices

const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;
const int daylightOffset_sec = 0;

BLEScan* pBLEScan;

String getIsoTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return String("1970-01-01T00:00:00Z");
  }

  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

float rssiToDistance(int rssi) {
  // Rough approximation using RSSI and reference power at 1 meter
  const float txPower = -59.0;
  float ratio = rssi * 1.0 / txPower;
  if (ratio < 1.0) {
    return pow(ratio, 10);
  } else {
    return (0.89976) * pow(ratio, 7.7095) + 0.111;
  }
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(ssid, password);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print('.');
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to Wi-Fi");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  connectWifi();
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  Serial.println("Starting BLE scan...");
  BLEScanResults* foundDevices = pBLEScan->start(5, false);
  int count = foundDevices->getCount();
  Serial.printf("Found %d BLE devices\n", count);

  String payload = "{\"devices\": [";
  String timestamp = getIsoTimestamp();

  for (int i = 0; i < count; i++) {
    BLEAdvertisedDevice device = foundDevices->getDevice(i);
    String mac = device.getAddress().toString().c_str();
    int rssi = device.getRSSI();
    float distance = rssiToDistance(rssi);

    if (i > 0) {
      payload += ",";
    }
    payload += "{\"mac_address\":\"" + mac + "\",\"rssi\":" + String(rssi) + ",\"distance\":" + String(distance, 2) + ",\"timestamp\":\"" + timestamp + "\"}";
  }

  payload += "],\"room_name\":\"" + String(roomName) + "\"}";
  if (count == 0) {
    Serial.println("No BLE devices found.");
    pBLEScan->clearResults();
    delay(10000);
    return;
  }
  
  Serial.println("Sending payload to backend:");
  Serial.println(payload);

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    if (client.connect(serverHost, serverPort)) {
      String request = String("POST ") + serverPath + " HTTP/1.1\r\n";
      request += String("Host: ") + serverHost + "\r\n";
      request += "Content-Type: application/json\r\n";
      request += String("Content-Length: ") + payload.length() + "\r\n";
      request += "Connection: close\r\n\r\n";
      request += payload;

      client.print(request);

      long timeout = millis() + 5000;
      while (client.connected() && millis() < timeout) {
        while (client.available()) {
          String line = client.readStringUntil('\n');
          Serial.println(line);
        }
      }
      client.stop();
    } else {
      Serial.println("Connection to backend failed");
    }
  } else {
    Serial.println("Wi-Fi not connected, skipping upload");
  }

  pBLEScan->clearResults();
  delay(15000);
}
