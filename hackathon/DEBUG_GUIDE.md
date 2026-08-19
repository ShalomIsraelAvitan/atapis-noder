# Arduino Communication Debugging Guide

## Step-by-Step Debugging Process

### Step 1: Check Arduino Connection

1. **Check if Arduino is connected:**
   ```bash
   # In browser console (F12):
   fetch('http://localhost:5000/api/arduino-status').then(r => r.json()).then(console.log)
   ```
   
   Expected output:
   ```json
   {
     "connected": true,
     "port": "COM3",
     "message": "Arduino connected on COM3"
   }
   ```

2. **If not connected, check available ports:**
   - Open Arduino IDE
   - Go to Tools → Port
   - Note which COM port is listed
   - Close Arduino IDE Serial Monitor if open

3. **Try to reconnect:**
   ```javascript
   fetch('http://localhost:5000/api/arduino-reconnect', {method: 'POST'})
     .then(r => r.json())
     .then(console.log)
   ```

### Step 2: Check Server Console Output

1. **Look at the Python server terminal** where you ran `python server.py`
2. **Check for these messages:**
   - `Searching for Arduino/ESP32...`
   - `Found port: COM3 - Arduino Uno`
   - `✓✓✓ Arduino connected on COM3 ✓✓✓`
   - Or error messages explaining why it failed

### Step 3: Test Command Sending

1. **Use the debug endpoint:**
   ```javascript
   // In browser console (F12):
   fetch('http://localhost:5000/api/arduino-debug', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({command: 'LIGHT_ON'})
   }).then(r => r.json()).then(console.log)
   ```

2. **Check the response:**
   - `arduino_connected`: Should be `true`
   - `test_command_result`: Should be `true`
   - `recent_messages`: Should show Arduino responses

### Step 4: Check Arduino Serial Monitor

1. **Open Arduino IDE**
2. **Open Serial Monitor** (Tools → Serial Monitor)
3. **Set baud rate to 9600**
4. **Watch for:**
   - `CMD: ALERT` - When command is received
   - `ALERT activated!` - When command is processed
   - Distance readings: `45cm`, `50cm`, etc.

### Step 5: Manual Test in Serial Monitor

1. **In Arduino Serial Monitor, manually type:**
   ```
   ALERT
   ```
   (Press Enter)

2. **Expected behavior:**
   - LED should turn ON
   - Beeper should sound for 5 seconds
   - LED should turn OFF after 5 seconds
   - You should see: `CMD: ALERT` and `ALERT activated!`

3. **If this works but server doesn't:**
   - The issue is in the Python server communication
   - Check Step 6

### Step 6: Check Python Server Debug Output

1. **When server sends a command, you should see:**
   ```
   🔵 [DEBUG] Preparing to send command: 'ALERT'
   🔵 [DEBUG] Arduino port: COM3, is_open: True
   🔵 [DEBUG] Bytes in waiting (before): 0
   🔵 [DEBUG] Command bytes: b'ALERT\r\n' (hex: 414c4552540d0a)
   🔵 [DEBUG] Bytes written: 7
   🔵 [DEBUG] Bytes in waiting (after send): 0
   🔵 [DEBUG] Arduino response: 'CMD: ALERT'
   ✅ Sent command to Arduino: 'ALERT' (7 bytes)
   ```

2. **If you see errors:**
   - `❌ Arduino not connected` → Go back to Step 1
   - `❌ Error sending command` → Check the error message

### Step 7: Check Browser Console

1. **Open browser console (F12 → Console tab)**
2. **Look for Arduino messages:**
   - `🚨 [Arduino 14:30:15] CMD: ALERT`
   - `🚨 [Arduino 14:30:15] ALERT activated!`
   - `📏 [Arduino 14:30:16] 45cm`

3. **If you don't see messages:**
   - Check if `/api/arduino-messages` endpoint is working:
     ```javascript
     fetch('http://localhost:5000/api/arduino-messages').then(r => r.json()).then(console.log)
     ```

### Step 8: Test Alert Detection

1. **Check what mode is detected:**
   - Look at Python server console
   - You should see: `Mode: SAFE/ALERT/DANGER, Person: True/False, Motion: standing/going/running, Weapon: True/False`

2. **To trigger ALERT mode:**
   - Someone needs to be **running** in front of camera
   - Or detect a **weapon** for DANGER mode

3. **Test manually:**
   ```javascript
   fetch('http://localhost:5000/api/test-alert', {method: 'POST'})
     .then(r => r.json())
     .then(console.log)
   ```

## Common Issues & Solutions

### Issue 1: "Arduino not connected"
**Solution:**
- Close Arduino IDE Serial Monitor
- Unplug and replug Arduino
- Restart Python server
- Use reconnect endpoint

### Issue 2: "Command sent but nothing happens"
**Solution:**
- Check Arduino Serial Monitor - do you see `CMD: ALERT`?
- If yes: Arduino code issue
- If no: Communication issue - check baud rate (should be 9600)

### Issue 3: "No messages in browser console"
**Solution:**
- Check if Arduino is sending messages to Serial Monitor
- Check `/api/arduino-messages` endpoint
- Make sure frontend is polling (check Network tab in browser)

### Issue 4: "Commands work manually but not from server"
**Solution:**
- Check Python server debug output
- Verify command format (should be `ALERT\r\n`)
- Check if `arduino_lock` is blocking
- Try increasing delays in `send_arduino_command`

## Quick Debug Commands

```javascript
// Check connection status
fetch('http://localhost:5000/api/arduino-status').then(r => r.json()).then(console.log)

// Get debug info
fetch('http://localhost:5000/api/arduino-debug').then(r => r.json()).then(console.log)

// Test command
fetch('http://localhost:5000/api/arduino-debug', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({command: 'ALERT'})
}).then(r => r.json()).then(console.log)

// Get recent messages
fetch('http://localhost:5000/api/arduino-messages').then(r => r.json()).then(console.log)

// Test alert endpoint
fetch('http://localhost:5000/api/test-alert', {method: 'POST'}).then(r => r.json()).then(console.log)
```

