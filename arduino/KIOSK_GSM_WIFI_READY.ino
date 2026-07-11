/**
 * ============================================================================
 * ATTENDBOX - Kiosk WiFi + GSM Integration (READY TO USE)
 * ============================================================================
 * 
 * This sketch connects your GSM module to the kiosk website!
 * When a student scans at the kiosk, SMS is sent automatically.
 * 
 * Hardware: ESP32 + SIM800L V2 GSM Module
 * 
 * QUICK SETUP:
 * 1. Update WiFi credentials below (WIFI_SSID and WIFI_PASSWORD)
 * 2. Update BACKEND_URL with your computer's IP address
 * 3. Upload to ESP32
 * 4. Scan at kiosk website → Parent gets SMS automatically!
 * 
 * Pin Connections:
 * ----------------
 * SIM800L V2 → ESP32
 * - TX  → GPIO 16 (RX2)
 * - RX  → GPIO 17 (TX2)
 * - VCC → 4.2V (External power supply - 2A minimum!)
 * - GND → GND (Common ground with ESP32)
 * - RST → GPIO 18 (Optional - for hardware reset)
 * 
 * ⚠️ CRITICAL: SIM800L needs external 4.2V 2A power supply!
 *              Add 1000µF capacitor across VCC/GND
 * 
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================================================
// 🔧 CONFIGURATION - UPDATE THESE VALUES!
// ============================================================================

// WiFi Credentials (YOUR WIFI)
const char* WIFI_SSID     = "YourWiFiName";        // ← CHANGE THIS!
const char* WIFI_PASSWORD = "YourWiFiPassword";    // ← CHANGE THIS!

// Backend API (YOUR COMPUTER IP)
const char* BACKEND_URL   = "http://10.194.43.63:5000";  // ← Current IP from ipconfig
const int   KIOSK_ID      = 1;

// SIM800L Configuration
#define SIM800_TX_PIN 17
#define SIM800_RX_PIN 16
#define SIM800_RST_PIN 18
#define SIM800_BAUD 9600

// Polling Configuration
#define POLL_INTERVAL 2000      // Poll backend every 2 seconds (FAST response!)
#define MAX_SMS_QUEUE 10        // Maximum SMS in queue
#define SMS_RETRY_DELAY 3000    // 3 seconds between retriesw
#define MAX_RETRIES 3           // Maximum retry attempts

// ============================================================================
// HARDWARE
// ============================================================================

HardwareSerial sim800(2);

// ============================================================================
// SMS QUEUE
// ============================================================================

struct SMSMessage {
  int smsId;
  String phoneNumber;
  String message;
  int retryCount;
  bool active;
};

SMSMessage smsQueue[MAX_SMS_QUEUE];
int queueHead = 0;
int queueTail = 0;

// ============================================================================
// GLOBAL STATE
// ============================================================================

unsigned long lastPollTime = 0;
unsigned long lastSmsAttempt = 0;
bool gsmReady = false;
bool wifiConnected = false;

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  printBanner();
  
  // Initialize GSM module
  initGSM();
  
  // Connect to WiFi
  connectWiFi();
  
  // Initialize SMS queue
  for (int i = 0; i < MAX_SMS_QUEUE; i++) {
    smsQueue[i].active = false;
    smsQueue[i].retryCount = 0;
  }
  
  Serial.println();
  Serial.println("✅ System ready!");
  Serial.println("🔍 Waiting for kiosk scans...");
  Serial.println();
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("⚠️  WiFi disconnected, reconnecting...");
      wifiConnected = false;
    }
    connectWiFi();
    delay(5000);
    return;
  } else if (!wifiConnected) {
    wifiConnected = true;
    Serial.println("✅ WiFi reconnected!");
  }
  
  // Poll backend for pending SMS
  if (millis() - lastPollTime >= POLL_INTERVAL) {
    lastPollTime = millis();
    pollForSMS();
  }
  
  // Process SMS queue
  if (gsmReady && (millis() - lastSmsAttempt >= SMS_RETRY_DELAY)) {
    processSMSQueue();
  }
  
  delay(100);
}

// ============================================================================
// PRINT BANNER
// ============================================================================

void printBanner() {
  Serial.println();
  Serial.println("╔═══════════════════════════════════════════════════════╗");
  Serial.println("║   ATTENDBOX - Kiosk WiFi + GSM Integration          ║");
  Serial.println("║   ESP32 + SIM800L V2                                 ║");
  Serial.println("╚═══════════════════════════════════════════════════════╝");
  Serial.println();
}

// ============================================================================
// WIFI CONNECTION
// ============================================================================

void connectWiFi() {
  Serial.print("📡 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✅ WiFi connected!");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Backend URL: ");
    Serial.println(BACKEND_URL);
    wifiConnected = true;
  } else {
    Serial.println("❌ WiFi connection failed!");
    Serial.println("   Please check WIFI_SSID and WIFI_PASSWORD");
    wifiConnected = false;
  }
}

// ============================================================================
// INITIALIZE SIM800L GSM MODULE
// ============================================================================

void initGSM() {
  Serial.println("📱 Initializing SIM800L GSM module...");
  
  pinMode(SIM800_RST_PIN, OUTPUT);
  digitalWrite(SIM800_RST_PIN, HIGH);
  
  sim800.begin(SIM800_BAUD, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(1000);
  
  // Hardware reset
  Serial.println("   Resetting SIM800L...");
  digitalWrite(SIM800_RST_PIN, LOW);
  delay(200);
  digitalWrite(SIM800_RST_PIN, HIGH);
  delay(3000);
  
  // Test AT
  Serial.println("   Testing AT commands...");
  for (int i = 0; i < 5; i++) {
    sim800.println("AT");
    delay(1000);
    if (sim800.available()) {
      String response = sim800.readString();
      if (response.indexOf("OK") != -1) {
        Serial.println("   ✅ AT command OK");
        break;
      }
    }
  }
  
  // Set SMS text mode
  sim800.println("AT+CMGF=1");
  delay(1000);
  
  // Set character set
  sim800.println("AT+CSCS=\"GSM\"");
  delay(1000);
  
  // Check signal
  Serial.print("   Signal: ");
  sim800.println("AT+CSQ");
  delay(1000);
  if (sim800.available()) {
    String response = sim800.readString();
    Serial.println(response);
  }
  
  // Check SIM
  sim800.println("AT+CPIN?");
  delay(1000);
  if (sim800.available()) {
    String response = sim800.readString();
    if (response.indexOf("READY") != -1) {
      Serial.println("   ✅ SIM card ready");
      gsmReady = true;
    } else {
      Serial.println("   ⚠️  SIM card not ready");
    }
  }
  
  // Check network
  sim800.println("AT+CREG?");
  delay(1000);
  if (sim800.available()) {
    String response = sim800.readString();
    Serial.print("   Network: ");
    Serial.println(response);
  }
  
  Serial.println();
  if (gsmReady) {
    Serial.println("✅ SIM800L ready to send SMS!");
  } else {
    Serial.println("⚠️  SIM800L initialization incomplete");
  }
}

// ============================================================================
// POLL BACKEND FOR PENDING SMS
// ============================================================================

void pollForSMS() {
  if (!wifiConnected) return;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/gsm/pending?kiosk_id=" + String(KIOSK_ID);
  
  http.begin(url);
  http.setTimeout(5000);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    StaticJsonDocument<2048> doc;
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      JsonArray smsArray = doc.as<JsonArray>();
      
      // Only show message if there are NEW pending SMS
      if (smsArray.size() > 0) {
        Serial.println();
        Serial.println("📡 New SMS from backend: " + String(smsArray.size()));
      }
      
      int newCount = 0;
      for (JsonObject sms : smsArray) {
        String phone = sms["phone_number"].as<String>();
        String message = sms["message"].as<String>();
        int smsId = sms["id"].as<int>();
        
        if (phone.length() > 0 && message.length() > 0) {
          if (addToQueue(phone, message, smsId)) {
            newCount++;
            Serial.println("   📩 Queued SMS ID: " + String(smsId));
            Serial.println("      To: " + phone);
            Serial.println("      Msg: " + message.substring(0, 50) + "...");
          }
        }
      }
      
      if (newCount > 0) {
        Serial.println("   ✅ Added " + String(newCount) + " new SMS to queue");
        Serial.println();
      }
    }
  } else if (httpCode > 0) {
    // Only log errors occasionally to avoid spam
    static unsigned long lastErrorLog = 0;
    if (millis() - lastErrorLog > 60000) { // Every 60 seconds max
      Serial.println("⚠️  Backend HTTP " + String(httpCode));
      lastErrorLog = millis();
    }
  }
  
  http.end();
}

// ============================================================================
// ADD SMS TO QUEUE
// ============================================================================

bool addToQueue(String phone, String message, int smsId) {
  // Check for duplicates - don't add if same SMS ID is already in queue
  for (int i = 0; i < MAX_SMS_QUEUE; i++) {
    if (smsQueue[i].active && smsQueue[i].smsId == smsId) {
      // SMS already in queue, skip
      return false;
    }
  }
  
  int nextTail = (queueTail + 1) % MAX_SMS_QUEUE;
  
  if (nextTail == queueHead) {
    Serial.println("⚠️  SMS queue full!");
    return false;
  }
  
  smsQueue[queueTail].smsId = smsId;
  smsQueue[queueTail].phoneNumber = phone;
  smsQueue[queueTail].message = message;
  smsQueue[queueTail].retryCount = 0;
  smsQueue[queueTail].active = true;
  
  queueTail = nextTail;
  return true;
}

// ============================================================================
// PROCESS SMS QUEUE
// ============================================================================

void processSMSQueue() {
  if (queueHead == queueTail) return;
  
  SMSMessage* currentSms = &smsQueue[queueHead];
  
  if (!currentSms->active) {
    queueHead = (queueHead + 1) % MAX_SMS_QUEUE;
    return;
  }
  
  Serial.println();
  Serial.println("📤 Sending SMS...");
  Serial.println("   ID: " + String(currentSms->smsId));
  Serial.println("   To: " + currentSms->phoneNumber);
  Serial.println("   Attempt: " + String(currentSms->retryCount + 1));
  
  bool success = sendSMS(currentSms->phoneNumber, currentSms->message);
  
  if (success) {
    Serial.println("✅ SMS sent successfully!");
    acknowledgeBackend(currentSms->smsId, "sent", "");
    currentSms->active = false;
    queueHead = (queueHead + 1) % MAX_SMS_QUEUE;
  } else {
    currentSms->retryCount++;
    
    if (currentSms->retryCount >= MAX_RETRIES) {
      Serial.println("❌ SMS failed after " + String(MAX_RETRIES) + " attempts");
      // Mark as failed in backend so it won't be returned again
      markFailedBackend(currentSms->smsId, "No GSM response after retries");
      currentSms->active = false;
      queueHead = (queueHead + 1) % MAX_SMS_QUEUE;
    } else {
      Serial.println("⚠️  SMS failed, will retry...");
    }
  }
  
  lastSmsAttempt = millis();
}

// ============================================================================
// SEND SMS VIA SIM800L
// ============================================================================

bool sendSMS(String phoneNumber, String message) {
  if (!gsmReady) {
    Serial.println("   ❌ GSM not ready");
    return false;
  }
  
  // Clear any pending data
  while (sim800.available()) sim800.read();
  delay(100);
  
  // Set SMS text mode
  sim800.println("AT+CMGF=1");
  delay(500);
  
  // Check for OK response
  String response = "";
  unsigned long timeout = millis() + 1000;
  while (millis() < timeout) {
    if (sim800.available()) {
      response += (char)sim800.read();
    }
  }
  
  if (response.indexOf("OK") == -1) {
    Serial.println("   ❌ Failed to set SMS mode");
    return false;
  }
  
  // Clear buffer
  while (sim800.available()) sim800.read();
  delay(100);
  
  // Send CMGS command
  sim800.print("AT+CMGS=\"");
  sim800.print(phoneNumber);
  sim800.println("\"");
  delay(1000);
  
  // Wait for '>' prompt
  if (!waitForPrompt()) {
    Serial.println("   ❌ No prompt received");
    Serial.println("   ⚠️  Check: SIM800L power, SIM card, network signal");
    return false;
  }
  
  // Send message text
  sim800.print(message);
  delay(100);
  
  // Send CTRL+Z to send SMS
  sim800.write(26);
  delay(100);
  
  // Wait for response
  unsigned long sendTimeout = millis() + 15000; // 15 seconds for SMS sending
  bool success = false;
  response = "";
  
  while (millis() < sendTimeout) {
    if (sim800.available()) {
      char c = sim800.read();
      response += c;
      Serial.print(c); // Echo response for debugging
      
      if (response.indexOf("+CMGS:") != -1) {
        success = true;
        break;
      }
      
      if (response.indexOf("ERROR") != -1) {
        Serial.println();
        Serial.println("   ❌ GSM ERROR response");
        break;
      }
    }
    delay(10);
  }
  
  Serial.println(); // New line after response
  
  if (!success) {
    Serial.println("   ❌ Timeout or error sending SMS");
  }
  
  return success;
}

// ============================================================================
// WAIT FOR '>' PROMPT
// ============================================================================

bool waitForPrompt() {
  unsigned long timeout = millis() + 5000;
  
  while (millis() < timeout) {
    if (sim800.available()) {
      char c = sim800.read();
      if (c == '>') {
        return true;
      }
    }
    delay(10);
  }
  
  return false;
}

// ============================================================================
// ACKNOWLEDGE TO BACKEND
// ============================================================================

void acknowledgeBackend(int smsId, String status, String errorMsg) {
  if (!wifiConnected) return;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/gsm/ack/" + String(smsId);
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<200> doc;
  doc["status"] = status;
  doc["sent_by"] = "gsm_module";
  doc["kiosk_id"] = KIOSK_ID;
  if (errorMsg.length() > 0) {
    doc["error_message"] = errorMsg;
  }
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.println("   ✅ Acknowledged to backend: " + status);
  } else {
    Serial.println("   ⚠️  Failed to acknowledge: HTTP " + String(httpCode));
  }
  
  http.end();
}

// ============================================================================
// MARK SMS AS FAILED IN BACKEND
// ============================================================================

void markFailedBackend(int smsId, String errorMsg) {
  if (!wifiConnected) return;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/gsm/failed/" + String(smsId);
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<200> doc;
  doc["error_message"] = errorMsg;
  doc["kiosk_id"] = KIOSK_ID;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.println("   ✅ Marked as failed in backend");
  } else {
    Serial.println("   ⚠️  Failed to mark as failed: HTTP " + String(httpCode));
  }
  
  http.end();
}
