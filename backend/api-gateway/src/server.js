// backend/api-gateway/src/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Kafka } = require('kafkajs');

const app = express();
const PORT = process.env.PORT || 4000;

// Kafka setup
const kafka = new Kafka({
  clientId: 'api-gateway',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

const producer = kafka.producer();

// Middleware
app.use(cors());
app.use(express.json());

// Service URLs
const SERVICES = {
  restaurant: process.env.RESTAURANT_SERVICE || 'http://restaurant-service:3001',
  order: process.env.ORDER_SERVICE || 'http://order-service:3002',
  user: process.env.USER_SERVICE || 'http://user-service:3003',
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway' });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP api_gateway_requests_total Total requests
# TYPE api_gateway_requests_total counter
api_gateway_requests_total ${Math.floor(Math.random() * 1000)}
  `);
});

// Restaurant routes
app.get('/api/restaurants', async (req, res) => {
  try {
    const response = await axios.get(`${SERVICES.restaurant}/restaurants`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching restaurants:', error.message);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const response = await axios.get(
      `${SERVICES.restaurant}/restaurants/${req.params.id}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

// User routes
app.post('/api/users/login', async (req, res) => {
  try {
    const response = await axios.post(`${SERVICES.user}/users/login`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(401).json({ error: 'Login failed' });
  }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const response = await axios.post(`${SERVICES.user}/users/register`, req.body);
    
    // Publish event to Kafka
    await producer.send({
      topic: 'user-events',
      messages: [
        {
          key: 'user-registered',
          value: JSON.stringify({ userId: response.data._id, email: req.body.email }),
        },
      ],
    });

    res.json(response.data);
  } catch (error) {
    res.status(400).json({ error: 'Registration failed' });
  }
});

// Order routes
app.post('/api/orders', async (req, res) => {
  try {
    const response = await axios.post(`${SERVICES.order}/orders`, req.body);
    
    // Publish order event to Kafka
    await producer.send({
      topic: 'order-events',
      messages: [
        {
          key: 'order-placed',
          value: JSON.stringify({
            orderId: response.data._id,
            userId: req.body.userId,
            total: req.body.total,
            timestamp: new Date(),
          }),
        },
      ],
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  try {
    const response = await axios.get(
      `${SERVICES.order}/orders/user/${req.params.userId}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Initialize Kafka producer
const initKafka = async () => {
  try {
    await producer.connect();
    console.log('Kafka producer connected');
  } catch (error) {
    console.error('Kafka connection error:', error);
  }
};

// Start server
app.listen(PORT, async () => {
  console.log(`API Gateway running on port ${PORT}`);
  await initKafka();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await producer.disconnect();
  process.exit(0);
});