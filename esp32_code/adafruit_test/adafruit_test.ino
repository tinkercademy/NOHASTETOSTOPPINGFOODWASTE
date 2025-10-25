/*
 * Adafruit ILI9341 Library Test
 * This sketch uses Adafruit's libraries as an alternative to TFT_eSPI.
 */

#include "SPI.h"
#include "Adafruit_GFX.h"
#include "Adafruit_ILI9341.h"

// Define pins for Software SPI
#define TFT_SCLK 20
#define TFT_MOSI 5

// Define pins for control lines
#define TFT_CS   10
#define TFT_DC   4
#define TFT_RST  21

// Create the TFT object using software SPI
Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Adafruit ILI9341 Test Initializing...");

  // Initialize the display
  tft.begin();

  Serial.println("Initialization complete.");

  // --- Run a simple test ---
  tft.fillScreen(ILI9341_BLACK);
  tft.setCursor(10, 10);
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(2);
  tft.println("Hello, World!");
  tft.println("This is Adafruit GFX.");
}

void loop() {
  // Keep the screen on, do nothing.
}
