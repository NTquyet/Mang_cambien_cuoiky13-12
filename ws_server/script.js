document.addEventListener('DOMContentLoaded', () => {
    const client = mqtt.connect('ws://192.168.121.82:9001', {
        clientId: 'DashboardClient-' + Math.random().toString(16).substr(2, 8),
        username: 'quyet',
        password: '123',
    });


    client.on('connect', () => {
        console.log('Connected to MQTT Broker');
        client.subscribe('home/temperature');
        client.subscribe('home/humidity');
        client.subscribe('home/light');
    });


    client.on('message', (topic, message) => {
        const value = message.toString();
        if (topic === 'home/temperature') {
            document.getElementById('temp-value').innerText = value;
        } else if (topic === 'home/humidity') {
            document.getElementById('humidity-value').innerText = value;
        } else if (topic === 'home/light') {
            document.getElementById('light-value').innerText = value;
        }
    });


    const ctx = document.getElementById('chart').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Nhiệt độ (°C)', data: [], borderColor: '#ff6384', fill: false },
                { label: 'Độ ẩm (%)', data: [], borderColor: '#36a2eb', fill: false },
                { label: 'Ánh sáng (lx)', data: [], borderColor: '#ffcd56', fill: false }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Biểu đồ Nhiệt độ, Độ ẩm, Ánh sáng' }
            },
            scales: { x: { beginAtZero: true }, y: { beginAtZero: true } }
        }
    });


    client.on('message', (topic, message) => {
        const time = new Date().toLocaleTimeString();
        const value = parseFloat(message.toString());
        chart.data.labels.push(time);
        if (topic === 'home/temperature') chart.data.datasets[0].data.push(value);
        if (topic === 'home/humidity') chart.data.datasets[1].data.push(value);
        if (topic === 'home/light') chart.data.datasets[2].data.push(value);
        chart.update();
    });


    // LED control logic
    const ledSwitches = [
        { id: 'led1-switch', topic: 'home/led1' },
        { id: 'led2-switch', topic: 'home/led2' },
        { id: 'led3-switch', topic: 'home/led3' }
    ];


    ledSwitches.forEach(switchInfo => {
        const switchElement = document.getElementById(switchInfo.id);
        switchElement.addEventListener('change', () => {
            const message = switchElement.checked ? 'on' : 'off';
            client.publish(switchInfo.topic, message);
        });
    });
});
