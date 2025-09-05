/*
 * ESP32-C3 LED Pin Finder (Watchdog Fix)
 *
 * This sketch will blink a series of common LED pins one by one.
 * Watch the built-in LED on your board. When it blinks, check the
 * Serial Monitor to see which GPIO pin is the correct one.
 */

// An array of common pins to test for the built-in LED
const int pinsToTest[] = {2, 7, 8, 10, 13, 21};

void setup() {
  Serial.begin(115200);
  Serial.println("--- LED Pin Finder ---");

  // Set all the pins we want to test as outputs
  for (int pin : pinsToTest) {
    pinMode(pin, OUTPUT);
  }
}

void loop() {
  // Loop through each pin in our array
  for (int pin : pinsToTest) {
    // Print which pin we are currently testing
    Serial.print("Testing GPIO pin: ");
    Serial.println(pin);

    // Turn the LED on for 2 seconds
    digitalWrite(pin, HIGH);
    delay(2000);

    // Turn the LED off
    digitalWrite(pin, LOW);
    delay(500); // Short pause before the next pin

    // Add yield() to prevent the watchdog timer from rebooting the chip.
    yield();
  }
}
