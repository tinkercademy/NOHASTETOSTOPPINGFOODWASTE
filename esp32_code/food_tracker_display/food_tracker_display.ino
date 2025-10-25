/*
 * WiFi Food Waste Tracker Display
 * 
 * Connects to WiFi, fetches expiring food data from an API,
 * and displays it on the ILI9341 TFT screen.
 */

// Network Libraries
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Display Libraries
#include "SPI.h"
#include "Adafruit_GFX.h"
#include "Adafruit_ILI9341.h"

// --- WiFi Credentials ---
const char* ssid = "aaaalex";
const char* password = "fccccy0305";

// --- Display Pin Configuration (Software SPI) ---
#define TFT_SCLK 20
#define TFT_MOSI 5
#define TFT_CS   10
#define TFT_DC   4
#define TFT_RST  21

// Create the TFT object
Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);

// --- API Endpoint ---
const char* api_url = "https://nohaste.dev.tk.sg/api/microcontroller/expiring?days=7";

// =====================================================================
//     SETUP WIFI
// =====================================================================
void setupWifi() {
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  tft.println("Connecting to WiFi...");
  
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

// =====================================================================
//     FETCH AND DISPLAY DATA
// =====================================================================
void checkExpiringFood() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    Serial.print("Making GET request to: ");
    Serial.println(api_url);
    
    http.begin(api_url);
    int httpCode = http.GET();

    if (httpCode == 200) {
      String payload = http.getString();
      Serial.println("Got payload:");
      Serial.println(payload);

      // Parse JSON
      DynamicJsonDocument doc(2048); // Increased size for safety
      DeserializationError error = deserializeJson(doc, payload);

      if (error) {
        Serial.print("deserializeJson() failed: ");
        Serial.println(error.c_str());
        tft.fillScreen(ILI9341_RED);
        tft.setCursor(10, 10);
        tft.setTextSize(2);
        tft.println("JSON Parse Failed");
        return;
      }

      int count = doc["count"];
      JsonArray items = doc["items"];

      // Display on TFT
      tft.fillScreen(ILI9341_BLACK);
      tft.setCursor(0, 5);
      tft.setTextColor(ILI9341_YELLOW);
      tft.setTextSize(2);
      tft.printf("Found %d expiring items:\n\n", count);

      tft.setTextColor(ILI9341_WHITE);
      tft.setTextSize(2);
      for (JsonObject item : items) {
        const char* name = item["name"];
        int daysLeft = item["days_left"];
        
        tft.printf("- %s (%d days)\n", name, daysLeft);
      }

    } else {
      Serial.printf("HTTP GET failed, error: %d\n", httpCode);
      tft.fillScreen(ILI9341_RED);
      tft.setCursor(10, 10);
      tft.setTextSize(2);
      tft.printf("HTTP Error: %d", httpCode);
    }

    http.end();
  } else {
    Serial.println("WiFi not connected");
  }
}

// =====================================================================
//     MAIN SETUP & LOOP
// =====================================================================
void setup() {
  Serial.begin(115200);
  
  // Init Display
  tft.begin();
  tft.setRotation(1); // Landscape
  tft.fillScreen(ILI9341_BLUE);
  tft.setCursor(10, 10);
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(2);
  
  // Init WiFi
  setupWifi();
  
  // Initial data fetch
  checkExpiringFood();
}

void loop() {
  // Update data every x seconds
  Serial.println("\nWaiting 5 seconds for next update...");
  delay(5000); 
  checkExpiringFood();
}
