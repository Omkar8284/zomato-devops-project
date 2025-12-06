// backend/order-service/src/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Kafka } = require('kafkajs');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Kafka setup
const kafka = new Kafka({
  clientId: 'order-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

const consumer = kafka.consumer({ groupId: 'order-group' });
const producer = kafka.producer();

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/orders';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [{
    name: String,
    price: Number,
    quantity: { type: Number, default: 1 },
  }],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Order = mongoose.model('Order', orderSchema);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

// Create order
app.post('/orders', async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();

    // Publish to Kafka
    await producer.send({
      topic: 'order-events',
      messages: [{
        key: order._id.toString(),
        value: JSON.stringify({
          event: 'order_created',
          orderId: order._id,
          userId: order.userId,
          total: order.total,
          status: order.status,
          timestamp: new Date(),
        }),
      }],
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get orders by user
app.get('/orders/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
app.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Publish status update to Kafka
    await producer.send({
      topic: 'order-status-updates',
      messages: [{
        key: order._id.toString(),
        value: JSON.stringify({
          event: 'status_updated',
          orderId: order._id,
          userId: order.userId,
          status: order.status,
          timestamp: new Date(),
        }),
      }],
    });

    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Kafka consumer for order events
const runConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order-events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());
      console.log('Received event:', event);

      // Process order events (e.g., send notifications, update inventory)
      if (event.event === 'order_created') {
        console.log(`New order created: ${event.orderId}`);
        // Simulate order confirmation after 2 seconds
        setTimeout(async () => {
          try {
            await Order.findByIdAndUpdate(event.orderId, { 
              status: 'confirmed',
              updatedAt: new Date()
            });
            console.log(`Order ${event.orderId} confirmed`);
          } catch (err) {
            console.error('Error confirming order:', err);
          }
        }, 2000);
      }
    },
  });
};

// Initialize Kafka
const initKafka = async () => {
  try {
    await producer.connect();
    console.log('Kafka producer connected');
    await runConsumer();
    console.log('Kafka consumer connected');
  } catch (error) {
    console.error('Kafka connection error:', error);
  }
};

app.listen(PORT, async () => {
  console.log(`Order service running on port ${PORT}`);
  await initKafka();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await consumer.disconnect();
  await producer.disconnect();
  process.exit(0);
});