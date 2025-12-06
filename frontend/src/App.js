// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetchRestaurants();
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const fetchRestaurants = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/restaurants`);
      setRestaurants(response.data);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/users/login`, {
        email,
        password,
      });
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setShowLogin(false);
    } catch (error) {
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setCart([]);
  };

  const addToCart = (item) => {
    setCart([...cart, item]);
  };

  const placeOrder = async () => {
    if (!user) {
      alert('Please login to place order');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/orders`, {
        userId: user._id,
        items: cart,
        total: cart.reduce((sum, item) => sum + item.price, 0),
      });
      alert('Order placed successfully!');
      setCart([]);
    } catch (error) {
      alert('Order failed');
    }
  };

  const filteredRestaurants = restaurants.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="App">
      <header className="header">
        <h1>🍕 FoodZone</h1>
        <div className="header-right">
          {user ? (
            <>
              <span>Welcome, {user.name}</span>
              <button onClick={handleLogout}>Logout</button>
              <span className="cart-badge">Cart ({cart.length})</span>
            </>
          ) : (
            <button onClick={() => setShowLogin(true)}>Login</button>
          )}
        </div>
      </header>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search restaurants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={handleLogin}
        />
      )}

      <div className="restaurants-grid">
        {filteredRestaurants.map((restaurant) => (
          <RestaurantCard
            key={restaurant._id}
            restaurant={restaurant}
            onAddToCart={addToCart}
          />
        ))}
      </div>

      {cart.length > 0 && (
        <div className="cart-footer">
          <span>Total: ${cart.reduce((sum, item) => sum + item.price, 0)}</span>
          <button onClick={placeOrder}>Place Order</button>
        </div>
      )}
    </div>
  );
}

const LoginModal = ({ onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={() => onLogin(email, password)}>Login</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

const RestaurantCard = ({ restaurant, onAddToCart }) => {
  return (
    <div className="restaurant-card">
      <img src={restaurant.image || '/placeholder.jpg'} alt={restaurant.name} />
      <h3>{restaurant.name}</h3>
      <p>{restaurant.cuisine}</p>
      <p>⭐ {restaurant.rating}</p>
      <div className="menu-items">
        {restaurant.menu?.slice(0, 3).map((item, idx) => (
          <div key={idx} className="menu-item">
            <span>{item.name}</span>
            <span>${item.price}</span>
            <button onClick={() => onAddToCart(item)}>+</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;