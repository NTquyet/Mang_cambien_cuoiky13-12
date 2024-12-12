const mqtt = require('mqtt');
const mysql = require('mysql2');

// MQTT Broker Configuration
const mqttOptions = {
  host: '192.168.121.82',
  port: 1885,
  username: 'quyet',
  password: '123',
};
const client = mqtt.connect(mqttOptions);

// MySQL Database Configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'quyet123',
  database: 'smarthome', // Đổi sang database chính xác
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Failed to connect to MySQL:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL database.');
});

// MQTT Topics
const topics = {
  temperature: 'home/temperature',
  humidity: 'home/humidity',
  light: 'home/light',
  windSpeed: 'home/wind-speed', // Thêm topic cho tốc độ gió
  led1: 'home/led1',
  led2: 'home/led2',
  led3: 'home/led3',
  allLights: 'home/all_lights',
};

// Initialize sensor data
let sensorData = { temperature: null, humidity: null, light: null, windSpeed: null };

// Subscribe to MQTT Topics
client.on('connect', () => {
  console.log('Connected to MQTT Broker.');
  client.subscribe(Object.values(topics), (err) => {
    if (err) {
      console.error('Failed to subscribe to topics:', err.message);
    } else {
      console.log('Subscribed to topics:', Object.values(topics));
    }
  });
});

// Function to save sensor data to MySQL
function saveSensorData({ temperature, humidity, light, windSpeed }) {
  const query = `INSERT INTO sensordata (temperature, humidity, light, wind_speed) VALUES (?, ?, ?, ?)`;
  db.query(query, [temperature, humidity, light, windSpeed], (err, results) => {
    if (err) {
      console.error('Error inserting sensor data into database:', err.message);
    } else {
      console.log('Sensor data saved successfully. Insert ID:', results.insertId);
    }
  });
}

// Function to save device action to MySQL
function saveDeviceAction(deviceName, status) {
  const query = `INSERT INTO device (device_name, status) VALUES (?, ?)`;
  db.query(query, [deviceName, status], (err, results) => {
    if (err) {
      console.error('Error inserting device action into database:', err.message);
    } else {
      console.log(`Device action saved: ${deviceName} -> ${status}. Insert ID:`, results.insertId);
    }
  });
}

// Handle incoming MQTT messages
client.on('message', (topic, message) => {
  try {
    const value = message.toString().trim();

    // Handle sensor data
    if (topic === topics.temperature) {
      sensorData.temperature = parseFloat(value);
      console.log(`Temperature received: ${value} °C`);
    } else if (topic === topics.humidity) {
      sensorData.humidity = parseFloat(value);
      console.log(`Humidity received: ${value} %`);
    } else if (topic === topics.light) {
      sensorData.light = parseFloat(value);
      console.log(`Light received: ${value} lx`);
    } else if (topic === topics.windSpeed) {
      const windSpeedData = JSON.parse(value);
      sensorData.windSpeed = parseFloat(windSpeedData.windSpeed);
      console.log(`Wind Speed received: ${sensorData.windSpeed} m/s`);
    }

    // Save sensor data if all fields are filled
    if (
      sensorData.temperature !== null &&
      sensorData.humidity !== null &&
      sensorData.light !== null &&
      sensorData.windSpeed !== null
    ) {
      saveSensorData(sensorData);

      // Reset sensor data after saving
      sensorData = { temperature: null, humidity: null, light: null, windSpeed: null };
    }

    // Handle device actions
    if (topic === topics.led1 || topic === topics.led2 || topic === topics.led3 || topic === topics.allLights) {
      const deviceName = topic.split('/')[1]; // Extract device name (e.g., "led1", "led2")
      const status = value.toLowerCase() === 'on' ? 'on' : 'off';
      console.log(`Device action received: ${deviceName} -> ${status}`);
      saveDeviceAction(deviceName, status);
    }
  } catch (error) {
    console.error('Error processing MQTT message:', error.message);
  }
});

// Handle errors
client.on('error', (err) => {
  console.error('MQTT connection error:', err.message);
});

db.on('error', (err) => {
  console.error('MySQL connection error:', err.message);
});