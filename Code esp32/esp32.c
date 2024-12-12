#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <WebSocketsServer.h> // Thư viện WebSocket

// Thông tin kết nối Wi-Fi và MQTT
const char* ssid = "@@";
const char* password = "12345679";
const char* mqtt_server = "192.168.121.82"; // Địa chỉ IP của MQTT broker
const char* mqtt_username = "quyet";
const char* mqtt_password = "123";
const int mqtt_port = 1885;

// Tên các topic MQTT
const char* led1_topic = "home/led1";
const char* led2_topic = "home/led2";
const char* led3_topic = "home/led3";
const char* all_lights_topic = "home/all_lights";

// Các topic để gửi dữ liệu cảm biến
const char* temperature_topic = "home/temperature";
const char* humidity_topic = "home/humidity";
const char* light_topic = "home/light";
const char* wind_speed_topic = "home/wind-speed"; // Thêm topic cho tốc độ gió

// Cảm biến DHT11
#define DHTPIN 4    // Chân kết nối DHT11
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Cảm biến BH1750
BH1750 lightMeter;

// Chân điều khiển LED
const int ledPin1 = 12;
const int ledPin2 = 13;
const int ledPin3 = 14;
const int ledPinWind = 5; // Chân GPIO D5 cho LED kiểm tra gió

// Tạo đối tượng WiFi, MQTT Client và WebSocket Server
WiFiClient espClient;
PubSubClient client(espClient);
WebSocketsServer webSocket(8081); // WebSocket trên cổng 81

// Hàm kết nối Wi-Fi
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

// Hàm xử lý sự kiện WebSocket
void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[%u] Connected from %s\n", num, ip.toString().c_str());
      break;
    }

    case WStype_TEXT: {
      String message = String((char*)payload);
      Serial.printf("WebSocket [%u] message: %s\n", num, message.c_str());

      // Điều khiển LED qua WebSocket
      if (message == "led1:on") {
        digitalWrite(ledPin1, HIGH);
        webSocket.sendTXT(num, "LED1 ON");
      } else if (message == "led1:off") {
        digitalWrite(ledPin1, LOW);
        webSocket.sendTXT(num, "LED1 OFF");
      } else if (message == "led2:on") {
        digitalWrite(ledPin2, HIGH);
        webSocket.sendTXT(num, "LED2 ON");
      } else if (message == "led2:off") {
        digitalWrite(ledPin2, LOW);
        webSocket.sendTXT(num, "LED2 OFF");
      } else if (message == "led3:on") {
        digitalWrite(ledPin3, HIGH);
        webSocket.sendTXT(num, "LED3 ON");
      } else if (message == "led3:off") {
        digitalWrite(ledPin3, LOW);
        webSocket.sendTXT(num, "LED3 OFF");
      } else if (message == "all:on") {
        digitalWrite(ledPin1, HIGH);
        digitalWrite(ledPin2, HIGH);
        digitalWrite(ledPin3, HIGH);
        webSocket.sendTXT(num, "ALL LEDs ON");
      } else if (message == "all:off") {
        digitalWrite(ledPin1, LOW);
        digitalWrite(ledPin2, LOW);
        digitalWrite(ledPin3, LOW);
        webSocket.sendTXT(num, "ALL LEDs OFF");
      }
      break;
    }

    default:
      break;
  }
}

// Hàm xử lý tin nhắn MQTT
void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  // Xử lý điều khiển từ MQTT
  Serial.printf("MQTT Message: [%s]: %s\n", topic, message.c_str());
  if (String(topic) == led1_topic) {
    digitalWrite(ledPin1, message == "on" ? HIGH : LOW);
  } else if (String(topic) == led2_topic) {
    digitalWrite(ledPin2, message == "on" ? HIGH : LOW);
  } else if (String(topic) == led3_topic) {
    digitalWrite(ledPin3, message == "on" ? HIGH : LOW);
  } else if (String(topic) == all_lights_topic) {
    digitalWrite(ledPin1, message == "on" ? HIGH : LOW);
    digitalWrite(ledPin2, message == "on" ? HIGH : LOW);
    digitalWrite(ledPin3, message == "on" ? HIGH : LOW);
  }
}

// Hàm kết nối MQTT
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("connected");
      client.subscribe(led1_topic);
      client.subscribe(led2_topic);
      client.subscribe(led3_topic);
      client.subscribe(all_lights_topic);
    } else {
      Serial.printf("failed, rc=%d\n", client.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(ledPin1, OUTPUT);
  pinMode(ledPin2, OUTPUT);
  pinMode(ledPin3, OUTPUT);
  pinMode(ledPinWind, OUTPUT); // Đặt chân GPIO D5 làm OUTPUT

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  dht.begin();
  Wire.begin();
  if (lightMeter.begin()) {
    Serial.println(F("BH1750 started."));
  } else {
    Serial.println(F("Error starting BH1750."));
  }

  webSocket.begin(); // Bắt đầu WebSocket
  webSocket.onEvent(webSocketEvent); // Gán hàm xử lý sự kiện WebSocket
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  webSocket.loop(); // Vòng lặp WebSocket

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  float lux = lightMeter.readLightLevel();
  float windSpeed = random(0, 100); // Tạo giá trị gió ngẫu nhiên từ 0 đến 100 m/s

  if (!isnan(humidity) && !isnan(temperature)) {
    client.publish(temperature_topic, String(temperature).c_str());
    client.publish(humidity_topic, String(humidity).c_str());

    // Gửi dữ liệu qua WebSocket
    webSocket.broadcastTXT("temperature:" + String(temperature));
    webSocket.broadcastTXT("humidity:" + String(humidity));
  }

  if (!isnan(lux)) {
    client.publish(light_topic, String(lux).c_str());
    webSocket.broadcastTXT("light:" + String(lux));
  }

  // Gửi giá trị gió ngẫu nhiên dưới dạng JSON
  String windSpeedJson = "{\"windSpeed\":" + String(windSpeed) + "}";
  client.publish(wind_speed_topic, windSpeedJson.c_str());
  webSocket.broadcastTXT("windSpeed:" + String(windSpeed));

  // Kiểm tra tốc độ gió và nháy LED nếu vượt quá 50 m/s
  if (windSpeed > 50) {
    flashWindLED();
  }

  delay(2000); // Đọc dữ liệu mỗi 2 giây
}
// Hàm để nháy LED ở chân GPIO D5
void flashWindLED() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(ledPinWind, HIGH);
    delay(500);
    digitalWrite(ledPinWind, LOW);
    delay(500);
  }
}