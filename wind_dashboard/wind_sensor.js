document.addEventListener('DOMContentLoaded', function() {
    const host = 'ws://192.168.121.82:9001';
    const options = {
        clean: true,
        connectTimeout: 4000,
        clientId: 'clientId-' + Math.random().toString(16).substr(2, 8),
        username: 'quyet',
        password: '123',
    };

    const client = mqtt.connect(host, options);

    client.on('connect', () => {
        console.log('Connected to MQTT Broker');
        client.subscribe('home/wind-speed');
        client.subscribe('home/led');
        client.subscribe('home/led-new'); // Subscribe để theo dõi trạng thái đèn LED mới
    });

    client.on('message', (topic, message) => {
        console.log(`Received message on topic ${topic}: ${message.toString()}`);
        try {
            const data = JSON.parse(message.toString());

            if (topic === 'home/wind-speed') {
                console.log('Wind Speed:', data.windSpeed);
                document.getElementById('wind-speed-value').innerText = data.windSpeed;

                // Cập nhật biểu đồ
                myChart.data.labels.push(new Date().toLocaleTimeString());
                if (myChart.data.labels.length > 6) myChart.data.labels.shift();

                myChart.data.datasets[0].data.push(data.windSpeed);
                if (myChart.data.datasets[0].data.length > 6) myChart.data.datasets[0].data.shift();

                myChart.update();

                // Kiểm tra tốc độ gió và nháy LED nếu tốc độ gió vượt quá 50
                if (data.windSpeed > 50) {
                    flashLED();
                }
            }

            if (topic === 'home/led-new') {
                console.log('LED New:', data.led);
                // Bạn có thể thêm logic xử lý cho đèn LED mới nếu cần
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    });

    const ctx = document.getElementById('wind-speed-chart').getContext('2d');

    const data = {
        labels: [],
        datasets: [
            {
                label: 'Tốc độ gió',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                fill: false,
                data: [],
                showLine: true,
                pointRadius: 0
            }
        ]
    };

    const optionsChart = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Biểu đồ Tốc độ gió',
                fontSize: 24,
                padding: 20,
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';

                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y;
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                grid: {
                    color: 'rgba(200, 200, 200, 0.3)',
                    beginAtZero: true
                }
            }
        }
    };

    const myChart = new Chart(ctx, { type: 'line', data: data, options: optionsChart });

    // Hàm để nháy LED trên web
    function flashLED() {
        let count = 0;
        const interval = setInterval(() => {
            const ledRightBox = document.getElementById('led-right-box');
            if (count % 2 === 0) {
                ledRightBox.classList.add('led-on');
                ledRightBox.classList.remove('led-off');
            } else {
                ledRightBox.classList.remove('led-on');
                ledRightBox.classList.add('led-off');
            }
            count++;
            if (count >= 6) {
                clearInterval(interval);
            }
        }, 500);
    }

    // Lắng nghe sự kiện từ WebSocket để nháy LED
    const webSocket = new WebSocket('ws://192.168.121.82:8081');
    webSocket.onmessage = function(event) {
        if (event.data === 'flashLED') {
            flashLED();
        }
    };
});