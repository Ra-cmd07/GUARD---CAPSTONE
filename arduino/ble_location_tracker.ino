// ============================================================================
// ESP32 BLE LOCATION TRACKER - AttendBox Integration
// ============================================================================
// Purpose: Detect student BLE devices and update their campus location
// Integration: Sends location updates to /api/location/ble-update
// Map Display: Updates automatically appear on parent dashboard map in real-time
// Distance: Fixed at 1 meter for all detections (not calculated from RSSI)
// ============================================================================

#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <time.h>
#include <ArduinoJson.h>  // Install via Library Manager: ArduinoJson by Benoit Blanchon

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION - UPDATE THESE FOR YOUR SETUP
// ═══════════════════════════════════════════════════════════════════════

// ─── WiFi CONFIGURATION ────────────────────────────────────────────────
const char* WIFI_SSID = "Infinix HOT 20 5G";
const char* WIFI_PASSWORD = "12345678000";

// ─── SERVER CONFIGURATION ──────────────────────────────────────────────
const char* SERVER_HOST = "10.170.131.63";        // Your backend IP address
const uint16_t SERVER_PORT = 5000;                // Backend port
const char* API_ENDPOINT = "/api/location/ble-update";  // Location tracking endpoint

// ─── OPTIONAL: API AUTHENTICATION ──────────────────────────────────────
// Uncomment and set if your backend requires API key authentication
// const char* API_KEY = "your-api-key-here";

// ─── BEACON CONFIGURATION ──────────────────────────────────────────────
// Each ESP32 acts as a virtual beacon at a specific campus location
// Deploy multiple ESP32 devices and change these settings for each one

const char* BEACON_ID = "BEACON_GATE1";           // Must match database ble_beacons.beacon_id
const char* LOCATION_NAME = "Gate 1 - Main Entrance";
const char* LOCATION_TYPE = "gate";               // gate, classroom, cafeteria, library, gym
const char* BUILDING = "Main Building";
const char* FLOOR = "Ground";

// ─── OTHER BEACON PRESETS (Comment/Uncomment as needed) ───────────────
/*
// Gate 2
const char* BEACON_ID = "BEACON_GATE2"; 
const char* LOCATION_NAME = "Gate 2 - Back Entrance"; 
const char* LOCATION_TYPE = "gate";
const char* BUILDING = "Main Building"; 
const char* FLOOR = "Ground";
*/

/*
// Classroom
const char* BEACON_ID = "BEACON_ROOM201"; 
const char* LOCATION_NAME = "Room 201"; 
const char* LOCATION_TYPE = "classroom";
const char* BUILDING = "Academic Building"; 
const char* FLOOR = "2nd Floor";
*/

/*
// Cafeteria
const char* BEACON_ID = "BEACON_CAFETERIA"; 
const char* LOCATION_NAME = "Cafeteria"; 
const char* LOCATION_TYPE = "cafeteria";
const char* BUILDING = "Main Building"; 
const char* FLOOR = "1st Floor";
*/

/*
// Library
const char* BEACON_ID = "BEACON_LIBRARY"; 
const char* LOCATION_NAME = "Library"; 
const char* LOCATION_TYPE = "library";
const char* BUILDING = "Learning Commons"; 
const char* FLOOR = "2nd Floor";
*/

/*
// Gymnasium
const char* BEACON_ID = "BEACON_GYM"; 
const char* LOCATION_NAME = "Gymnasium"; 
const char* LOCATION_TYPE = "gym";
const char* BUILDING = "Sports Complex"; 
const char* FLOOR = "Ground";
*/

// ─── DETECTION CONFIGURATION ───────────────────────────────────────────
const int RSSI_THRESHOLD = -30;                   // EXTREMELY close detection (~1 cm or touching)
                                                  // -30 = touching/1cm, -35 = 2-3cm, -40 = 5cm
const int SCAN_DURATION = 5;                      // Seconds per BLE scan
const int SCAN_INTERVAL = 15000;                  // 15 seconds between scans
const float FIXED_DISTANCE = 0.01;                // Always report 1 centimeter (0.01 meters)
const int WIFI_CONNECT_TIMEOUT = 20000;           // 20 seconds timeout for WiFi

// ─── NTP & TIMEZONE ────────────────────────────────────────────────────
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET = 8 * 3600;                 // UTC+8 (Philippines)
const int DAYLIGHT_OFFSET = 0;                    // No DST in Philippines

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL VARIABLES
// ═══════════════════════════════════════════════════════════════════════

BLEScan* bleScan;

struct Statistics {
  unsigned long successful_updates = 0;
  unsigned long failed_updates = 0;
  unsigned long devices_detected = 0;
  unsigned long wifi_reconnects = 0;
} stats;

// ═══════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get current timestamp in ISO 8601 format
 */
String getIsoTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "1970-01-01T00:00:00Z";
  }
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

/**
 * Normalize MAC address format (AA:BB:CC:DD:EE:FF)
 */
String normalizeMacAddress(String mac) {
  mac.toUpperCase();
  mac.replace("-", ":");
  return mac;
}

/**
 * Connect to WiFi with enhanced retry logic
 */
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;  // Already connected
  }

  Serial.print("\n📡 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startTime) < WIFI_CONNECT_TIMEOUT) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("   Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n❌ WiFi connection failed!");
    Serial.print("   Status Code: ");
    Serial.println(WiFi.status());
    stats.wifi_reconnects++;
  }
}

/**
 * Send location update to backend API
 */
bool sendLocationUpdate(String macAddress, int rssi) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("   ❌ WiFi not connected");
    return false;
  }

  HTTPClient http;
  WiFiClient client;

  // Build API URL
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + API_ENDPOINT;

  if (!http.begin(client, url)) {
    Serial.println("   ❌ HTTP begin failed");
    return false;
  }

  // Build JSON payload
  DynamicJsonDocument doc(512);
  doc["mac_address"] = macAddress;
  doc["beacon_id"] = BEACON_ID;
  doc["signal_strength"] = rssi;
  
  String payload;
  serializeJson(doc, payload);

  // Set headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Connection", "close");
  
  // Optional: Add API key authentication if configured
  #ifdef API_KEY
  http.addHeader("Authorization", String("Bearer ") + API_KEY);
  #endif
  
  http.setTimeout(10000);

  // Send POST request
  int httpCode = http.POST(payload);

  bool success = false;

  if (httpCode > 0) {
    String response = http.getString();

    // Parse JSON response
    DynamicJsonDocument responseDoc(1024);
    DeserializationError error = deserializeJson(responseDoc, response);

    if (!error) {
      const char* message = responseDoc["message"];
      const char* studentName = responseDoc["student_name"];
      const char* location = responseDoc["location"];
      bool attendanceMarked = responseDoc["attendance_marked"] | false;
      const char* attendanceStatus = responseDoc["attendance_status"];

      if (httpCode == 201) {
        // Successfully updated location
        Serial.print("   ✅ ");
        Serial.print(studentName ? studentName : "Student");
        Serial.print(" → ");
        Serial.println(location ? location : "Location updated");
        
        // Show attendance status if marked
        if (attendanceMarked && attendanceStatus) {
          Serial.print("      📋 Attendance: ");
          if (strcmp(attendanceStatus, "checked_in") == 0) {
            Serial.println("✅ CHECKED IN");
          } else if (strcmp(attendanceStatus, "checked_out") == 0) {
            Serial.println("✅ CHECKED OUT");
          }
        } else if (attendanceStatus && strcmp(attendanceStatus, "already_marked") == 0) {
          Serial.println("      ℹ️  Attendance already marked today");
        }
        
        success = true;
        stats.successful_updates++;
      } else if (httpCode == 404) {
        Serial.println("   ⚠️  Student not registered");
      } else if (httpCode == 409) {
        // Duplicate - already recorded (not an error)
        Serial.print("   ℹ️  ");
        Serial.println(studentName ? studentName : "Already recorded");
        success = true;
      } else {
        Serial.print("   ⚠️  ");
        Serial.println(message ? message : response.c_str());
      }
    } else {
      // JSON parse failed - show raw response
      Serial.print("   Response (HTTP ");
      Serial.print(httpCode);
      Serial.print("): ");
      Serial.println(response.substring(0, 100));  // First 100 chars
      
      if (httpCode >= 200 && httpCode < 300) {
        success = true;
      }
    }
  } else {
    // HTTP request failed
    Serial.print("   ❌ HTTP ");
    Serial.print(httpCode);
    Serial.print(": ");
    Serial.println(http.errorToString(httpCode));
    stats.failed_updates++;
    
    // Try direct TCP test for debugging
    if (httpCode == -1) {
      Serial.print("   🔍 Testing TCP connection to ");
      Serial.print(SERVER_HOST);
      Serial.print(":");
      Serial.println(SERVER_PORT);
      
      if (client.connect(SERVER_HOST, SERVER_PORT)) {
        Serial.println("   ✅ TCP connection successful");
        client.stop();
      } else {
        Serial.println("   ❌ TCP connection failed");
      }
    }
  }

  http.end();
  return success;
}

/**
 * Check if device is within proximity threshold
 */
bool isWithinRange(int rssi) {
  // Stronger signal (higher RSSI) = closer device
  // -70 dBm is roughly 1 meter for most BLE devices
  return rssi >= RSSI_THRESHOLD;
}

// ═══════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n╔════════════════════════════════════════════════════════════╗");
  Serial.println("║     AttendBox BLE Location Tracker - ESP32 v2.0          ║");
  Serial.println("╚════════════════════════════════════════════════════════════╝");
  
  Serial.println("\n📍 Beacon Configuration:");
  Serial.print("   Beacon ID: ");
  Serial.println(BEACON_ID);
  Serial.print("   Location: ");
  Serial.println(LOCATION_NAME);
  Serial.print("   Type: ");
  Serial.println(LOCATION_TYPE);
  Serial.print("   Building: ");
  Serial.println(BUILDING);
  Serial.print("   Floor: ");
  Serial.println(FLOOR);
  Serial.print("   Detection Range: ");
  Serial.print(FIXED_DISTANCE * 100);  // Show in centimeters
  Serial.println(" cm (MUST BE TOUCHING or within 1cm)");
  Serial.print("   RSSI Threshold: ");
  Serial.print(RSSI_THRESHOLD);
  Serial.println(" dBm (device must touch ESP32)");

  // Connect to WiFi
  connectWiFi();

  // Initialize NTP time sync
  Serial.print("\n⏰ Synchronizing time with NTP...");
  configTime(GMT_OFFSET, DAYLIGHT_OFFSET, NTP_SERVER);
  
  time_t now = time(nullptr);
  int attempts = 0;
  while (now < 24 * 3600 && attempts < 20) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }
  
  if (now > 24 * 3600) {
    Serial.println(" ✅");
    Serial.print("   Current time: ");
    Serial.println(getIsoTimestamp());
  } else {
    Serial.println(" ⚠️");
    Serial.println("   Time sync failed - timestamps may be incorrect");
  }

  // Initialize BLE scanner
  Serial.print("\n🔵 Initializing BLE scanner...");
  BLEDevice::init("");
  bleScan = BLEDevice::getScan();
  bleScan->setActiveScan(true);
  bleScan->setInterval(100);
  bleScan->setWindow(99);
  Serial.println(" ✅");

  Serial.println("\n╔════════════════════════════════════════════════════════════╗");
  Serial.println("║   Ready! Scanning for students and updating live map...  ║");
  Serial.println("╚════════════════════════════════════════════════════════════╝\n");
  
  delay(2000);  // Give time to read startup messages
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi disconnected - reconnecting...");
    connectWiFi();
    delay(1000);
    return;
  }

  // Start BLE scan
  Serial.println("════════════════════════════════════════════════════════════");
  Serial.print("📡 Scanning for BLE devices at ");
  Serial.println(getIsoTimestamp());
  Serial.print("   Beacon: ");
  Serial.print(BEACON_ID);
  Serial.print(" (");
  Serial.print(LOCATION_NAME);
  Serial.println(")");

  BLEScanResults* results = bleScan->start(SCAN_DURATION, false);
  int deviceCount = results->getCount();
  
  Serial.printf("✓ Found %d BLE devices\n", deviceCount);
  stats.devices_detected += deviceCount;

  if (deviceCount == 0) {
    Serial.println("ℹ️  No devices detected in range");
  } else {
    Serial.println("\n📋 Detected Devices:");
    Serial.println("┌─────────────────────┬───────┬──────────┬────────┐");
    Serial.println("│   MAC Address       │ RSSI  │ Distance │ Status │");
    Serial.println("├─────────────────────┼───────┼──────────┼────────┤");

    int processedDevices = 0;

    for (int i = 0; i < deviceCount; i++) {
      BLEAdvertisedDevice device = results->getDevice(i);
      String mac = normalizeMacAddress(String(device.getAddress().toString().c_str()));
      int rssi = device.getRSSI();

      // Check if device is within range
      if (isWithinRange(rssi)) {
        char line[80];
        sprintf(line, "│ %-19s │ %5d │ %5.2fm   │", mac.c_str(), rssi, FIXED_DISTANCE);
        Serial.print(line);

        // Send BLE detection to kiosk via serial (for USB connection)
        Serial.print("BLE_DETECT:");
        Serial.print(mac);
        Serial.print(":");
        Serial.println(rssi);

        // Send location update to backend via WiFi
        bool updated = sendLocationUpdate(mac, rssi);
        
        if (updated) {
          Serial.println(" ✅ OK  │");
        } else {
          Serial.println(" ❌ FAIL│");
        }
        
        processedDevices++;
        delay(100); // Small delay between updates
      } else {
        // Device too far away
        char line[80];
        sprintf(line, "│ %-19s │ %5d │  Too far │ SKIP   │", mac.c_str(), rssi);
        Serial.println(line);
      }
    }

    Serial.println("└─────────────────────┴───────┴──────────┴────────┘");
    Serial.printf("\n📊 Processed %d/%d devices within range\n", processedDevices, deviceCount);
  }

  // Print statistics
  Serial.println("\n╔════════════════════════════════════════════════════════════╗");
  Serial.println("║                    Session Statistics                     ║");
  Serial.println("╚════════════════════════════════════════════════════════════╝");
  Serial.printf("✅ Successful updates: %lu\n", stats.successful_updates);
  Serial.printf("❌ Failed updates: %lu\n", stats.failed_updates);
  Serial.printf("📱 Total devices detected: %lu\n", stats.devices_detected);
  Serial.printf("📡 WiFi reconnects: %lu\n", stats.wifi_reconnects);
  Serial.printf("⏱️  Uptime: %lu seconds\n", millis() / 1000);
  
  float successRate = stats.successful_updates + stats.failed_updates > 0 
    ? (100.0 * stats.successful_updates) / (stats.successful_updates + stats.failed_updates)
    : 0;
  Serial.printf("📈 Success rate: %.1f%%\n", successRate);
  Serial.println();

  // Clean up and wait
  bleScan->clearResults();
  
  Serial.printf("⏳ Waiting %d seconds until next scan...\n\n", SCAN_INTERVAL / 1000);
  delay(SCAN_INTERVAL);
}
