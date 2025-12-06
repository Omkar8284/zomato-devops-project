// backend/restaurant-service/src/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/restaurants';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Restaurant Schema
const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cuisine: String,
  rating: Number,
  image: String,
  address: String,
  menu: [{
    name: String,
    price: Number,
    description: String,
    image: String,
  }],
  createdAt: { type: Date, default: Date.now },
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'restaurant-service' });
});

// Get all restaurants
app.get('/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant by ID
app.get('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create restaurant (for seeding)
app.post('/restaurants', async (req, res) => {
  try {
    const restaurant = new Restaurant(req.body);
    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Seed initial data
app.post('/restaurants/seed', async (req, res) => {
  try {
    await Restaurant.deleteMany({});
    
    const sampleRestaurants = [
      {
        name: 'Pizza Palace',
        cuisine: 'Italian',
        rating: 4.5,
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591',
        address: '123 Main St',
        menu: [
          { name: 'Margherita Pizza', price: 12.99, description: 'Classic tomato and mozzarella' },
          { name: 'Pepperoni Pizza', price: 14.99, description: 'Spicy pepperoni with cheese' },
          { name: 'Veggie Supreme', price: 13.99, description: 'Loaded with vegetables' },
        ],
      },
      {
        name: 'Burger Barn',
        cuisine: 'American',
        rating: 4.2,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
        address: '456 Oak Ave',
        menu: [
          { name: 'Classic Burger', price: 9.99, description: 'Beef patty with lettuce and tomato' },
          { name: 'Cheese Burger', price: 10.99, description: 'With cheddar cheese' },
          { name: 'Bacon Burger', price: 11.99, description: 'Crispy bacon added' },
        ],
      },
      {
        name: 'Sushi Station',
        cuisine: 'Japanese',
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351',
        address: '789 Pine Rd',
        menu: [
          { name: 'California Roll', price: 8.99, description: 'Crab and avocado' },
          { name: 'Salmon Nigiri', price: 12.99, description: 'Fresh salmon' },
          { name: 'Tuna Sashimi', price: 15.99, description: 'Premium tuna slices' },
        ],
      },
    ];

    const inserted = await Restaurant.insertMany(sampleRestaurants);
    res.json({ message: 'Seeded successfully', count: inserted.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Restaurant service running on port ${PORT}`);
});