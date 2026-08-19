#define MAX_RANG (520)
#define ADC_SOLUTION (1023.0)

int sensityPin = A0;
int speakerPin = 8;
int ledPin = 3;

String input = "";

// ESP32 tone generation variables
bool isBeeping = false;
unsigned long beepStartTime = 0;
unsigned long beepDuration = 0;
int beepChannel = 0; // LEDC channel for ESP32

void setup() {
  Serial.begin(9600);
  pinMode(speakerPin, OUTPUT);
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW); // Start with LED off
  
  // ESP32: Setup LEDC for tone generation
  #ifdef ESP32
    ledcSetup(beepChannel, 2000, 8); // Channel, frequency, resolution
    ledcAttachPin(speakerPin, beepChannel);
  #endif
}

float dist_t, sensity_t;

void loop() {

  // ESP32: Check if beep duration has elapsed
  #ifdef ESP32
    if(isBeeping && (millis() - beepStartTime >= beepDuration))
    {
      stopTone(speakerPin);
      isBeeping = false;
      // Turn off LED after beep completes (for ALERT command)
      if(digitalRead(ledPin) == HIGH)
      {
        digitalWrite(ledPin, LOW);
      }
    }
  #endif

  // Read serial commands (check first, before distance sensor)
  while(Serial.available() > 0)
  {
    char c = Serial.read();
    if(c == '\n' || c == '\r')
    {
      if(input.length() > 0)
      {
        processCommand(input);
        input = "";
      }
      // If we got a newline, break to process the command immediately
      break;
    }
    else if(c >= 32 && c <= 126) // Only add printable characters
    {
      input += c;
    }
    // Small delay to allow full command to arrive
    delay(5);
  }

  // distance sensor - send distance reading
  sensity_t = analogRead(sensityPin);
  dist_t = sensity_t * MAX_RANG / ADC_SOLUTION;
  
  // Send distance reading (only if not currently processing a command)
  if(!isBeeping || (millis() - beepStartTime < 100)) // Don't interfere during beep
  {
    Serial.print(dist_t,0);
    Serial.println("cm");
  }

  delay(500);
}

// ESP32 compatible tone function
void playTone(int pin, int frequency, unsigned long duration) {
  #ifdef ESP32
    ledcWriteTone(beepChannel, frequency);
    beepStartTime = millis();
    beepDuration = duration;
    isBeeping = true;
  #else
    // Arduino Uno/Nano
    tone(pin, frequency);
    delay(duration);
    noTone(pin);
  #endif
}

// ESP32 compatible noTone function
void stopTone(int pin) {
  #ifdef ESP32
    ledcWriteTone(beepChannel, 0);
    isBeeping = false;
  #else
    // Arduino Uno/Nano
    noTone(pin);
  #endif
}

void processCommand(String cmd)
{
  cmd.trim();
  
  // Debug: echo received command
  Serial.print("CMD: ");
  Serial.println(cmd);
  
  if(cmd == "ALERT")
  {
    // Turn on LED and sound beeper for 5 seconds
    digitalWrite(ledPin, HIGH);
    playTone(speakerPin, 2000, 5000); // 2000 Hz tone for 5 seconds
    Serial.println("ALERT activated!");
    #ifndef ESP32
      // For Arduino, delay is handled in playTone, so LED turns off after beep
      digitalWrite(ledPin, LOW);
    #else
      // For ESP32, LED will be turned off in loop() after beep duration
      // Store that this was an ALERT command so we know to turn off LED
      beepDuration = 5000; // Ensure duration is set
    #endif
  }
  else if(cmd == "LIGHT_ON")
  {
    digitalWrite(ledPin, HIGH);
  }
  else if(cmd == "LIGHT_OFF")
  {
    digitalWrite(ledPin, LOW);
  }
  else if(cmd == "TOGGLE_LIGHT")
  {
    digitalWrite(ledPin, !digitalRead(ledPin));
  }
  else if(cmd == "BEEPER_ON")
  {

    playTone(speakerPin, 2000, 1000); // Sound for 5 seconds
  }
  else if(cmd == "BEEPER_OFF")
  {
    stopTone(speakerPin);
  }
}
