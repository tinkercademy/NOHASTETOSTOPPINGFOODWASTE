/*
 * Original Display Test Sketch
 */

#include <TFT_eSPI.h>

TFT_eSPI tft = TFT_eSPI();

void setup() {
  Serial.begin(115200);

  tft.init();
//  tft.setRotation(1);  // Landscape mode

  // Clear screen
//  tft.fillScreen(TFT_BLACK);

  // Test display
//  tft.setTextColor(TFT_WHITE, TFT_BLACK);
//  tft.setTextSize(2);
//  tft.drawString("ESP32-C3", 10, 10);
//  tft.drawString("TFT Test", 10, 40);

  // Draw some shapes
//  tft.drawRect(10, 80, 100, 50, TFT_RED);
//  tft.fillCircle(200, 100, 30, TFT_GREEN);

  Serial.println("TFT Display initialized");
}

void loop() {
  // Rainbow text
//  for(int i = 0; i < 8; i++) {
//    tft.setTextColor(tft.color565(255, i*32, 255-i*32));
//    tft.drawString("Rainbow!", 10, 150 + i*20);
//    delay(200);
//  }
//  delay(1000);
//  tft.fillRect(10, 150, 200, 160, TFT_BLACK); // Clear rainbow area
  Serial.println("TFT Display initialized");
  delay(1000);
}
