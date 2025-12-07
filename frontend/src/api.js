import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Attach current store id from localStorage (if any) to every request
API.interceptors.request.use((cfg) => {
  try {
    const raw = localStorage.getItem('currentStore');
    if (raw) {
      const store = JSON.parse(raw);
      if (store && store._id) cfg.headers['x-store-id'] = store._id;
    }
  } catch (e) {
    // ignore
  }
  return cfg;
});

export const fetchProducts = async () => {
  const response = await API.get('/products');
  return response.data;
};

export const deleteProduct = async (id) => {
  return [
    { id: 1, name: "Product 1", price: 100, stock: 10 },
    { id: 2, name: "Product 2", price: 200, stock: 5 },
  ];
};

export default API;



//const response = await API.get('/products');
  //return response.data;