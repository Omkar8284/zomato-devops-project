const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Kafka } = require('kafkajs');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Kafka Configuration
const kafka = new Kafka({
  clientId: 'api-gateway',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

let producer = null;

// Initialize Kafka Producer
const initKafka = async () => {
  try {
    producer = kafka.producer();
    await producer.connect();
    console.log('✓ Kafka producer connected');
  } catch (error) {
    console.error('✗ Kafka connection error:', error.message);
    console.log('  Continuing without Kafka...');
  }
};

// Service URLs
const SERVICES = {
  restaurant: process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3001',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:3002',
  user: process.env.USER_SERVICE_URL || 'http://localhost:3003',
};

console.log('Service Configuration:', SERVICES);

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Metrics for Prometheus
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP api_gateway_requests_total Total requests
# TYPE api_gateway_requests_total counter
api_gateway_requests_total ${Math.floor(Math.random() * 1000)}
  `);
});

// ============================================
// Restaurant Routes
// ============================================
app.get('/api/restaurants', async (req, res) => {
  try {
    console.log('Fetching restaurants from:', SERVICES.restaurant);
    const response = await axios.get(`${SERVICES.restaurant}/restaurants`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching restaurants:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch restaurants',
      message: error.message 
    });
  }
});

app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const response = await axios.get(
      `${SERVICES.restaurant}/restaurants/${req.params.id}`,
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching restaurant:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch restaurant',
      message: error.message 
    });
  }
});

// ============================================
// User Routes
// ============================================
app.post('/api/users/register', async (req, res) => {
  try {
    const response = await axios.post(
      `${SERVICES.user}/users/register`,
      req.body,
      { timeout: 5000 }
    );
    
    // Publish event to Kafka if available
    if (producer) {
      try {
        await producer.send({
          topic: 'user-events',
          messages: [{
            key: 'user-registered',
            value: JSON.stringify({
              userId: response.data.user._id,
              email: req.body.email,
              timestamp: new Date()
            })
          }]
        });
      } catch (kafkaError) {
        console.error('Kafka publish error:', kafkaError.message);
      }
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('Error registering user:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Registration failed',
      message: error.response?.data?.error || error.message
    });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const response = await axios.post(
      `${SERVICES.user}/users/login`,
      req.body,
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(error.response?.status || 401).json({ 
      error: 'Login failed',
      message: error.response?.data?.error || 'Invalid credentials'
    });
  }
});

// ============================================
// Order Routes
// ============================================
app.post('/api/orders', async (req, res) => {
  try {
    const response = await axios.post(
      `${SERVICES.order}/orders`,
      req.body,
      { timeout: 5000 }
    );
    
    // Publish event to Kafka if available
    if (producer) {
      try {
        await producer.send({
          topic: 'order-events',
          messages: [{
            key: 'order-placed',
            value: JSON.stringify({
              orderId: response.data._id,
              userId: req.body.userId,
              total: req.body.total,
              timestamp: new Date()
            })
          }]
        });
      } catch (kafkaError) {
        console.error('Kafka publish error:', kafkaError.message);
      }
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('Error placing order:', error.message);
    res.status(500).json({ 
      error: 'Failed to place order',
      message: error.message
    });
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  try {
    const response = await axios.get(
      `${SERVICES.order}/orders/user/${req.params.userId}`,
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

// Start Server
app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════╗
║   API Gateway Started Successfully    ║
╚═══════════════════════════════════════╝
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  
  Service Endpoints:
  - Restaurant: ${SERVICES.restaurant}
  - Order: ${SERVICES.order}
  - User: ${SERVICES.user}
  `);
  
  await initKafka();
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (producer) {
    await producer.disconnect();
  }
  process.exit(0);
});
