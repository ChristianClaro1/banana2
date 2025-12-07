import React, { useState, useEffect, useMemo } from "react";
import API from "../api";
import logo from "../assets/salespoint-logo.png";
import "../pages-css/dashboard.css";

/* Chart.js imports */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Line } from "react-chartjs-2";

/* Register ChartJS components */
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title
);

const DashboardChart = ({ weeklySales, recentOrders }) => {
  // Show current week (Monday -> Sunday) aligned to system date.
  // Auto-updates when `recentOrders` changes and when the system date rolls over.
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update every minute so the component detects midnight rollover.
    const iv = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    // JS: 0=Sunday, 1=Monday...
    const diff = (day === 0) ? -6 : 1 - day; // go back to Monday
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const aggregated = useMemo(() => {
    const orders = Array.isArray(recentOrders) ? recentOrders : [];
    const monday = getMonday(now);
    // build Monday..Sunday
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }

    const map = {};
    days.forEach((d) => {
      const key = d.toISOString().split('T')[0];
      map[key] = 0;
    });

    for (const o of orders) {
      const dateStr = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : (o.date || null);
      if (!dateStr) continue;
      if (map[dateStr] === undefined) continue; // outside current week
      const amt = Number(o.totalAmount ?? o.amount ?? o.total ?? 0) || 0;
      map[dateStr] = (map[dateStr] || 0) + amt;
    }

    const pts = days.map((d) => {
      const key = d.toISOString().split('T')[0];
      return {
        // label: 'Monday' or 'Mon, Dec 8' — use short day + date for clarity
        label: d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
        value: map[key] || 0,
      };
    });

    return pts;
  }, [recentOrders, now]);

  if (!aggregated || aggregated.length === 0) return <div style={{ textAlign: 'center' }}>Loading chart...</div>;

  const labels = aggregated.map((p) => p.label);
  const data = aggregated.map((p) => p.value);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Sales',
        data,
        borderColor: '#1abc9c',
        backgroundColor: 'rgba(26,188,156,0.12)',
        tension: 0.2,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#1abc9c',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Sales Overview' },
    },
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: 'Day (Monday → Sunday)' },
        ticks: { maxRotation: 0, autoSkip: false },
      },
      y: {
        title: { display: true, text: 'Total Sales (₱)' },
        beginAtZero: true,
      },
    },
  };

  return <Line data={chartData} options={options} />;
};

const Dashboard = () => {
  const [weeklySales, setWeeklySales] = useState([]);
  const [summary, setSummary] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);

  useEffect(() => {
    let mounted = true;

    const fetchDashboard = async () => {
      try {
        const res = await API.get('/dashboard');
        if (!mounted) return;
        setWeeklySales(res.data.weeklySales || []);
        setSummary(res.data.summary || {});
        setRecentOrders(res.data.recentOrders || []);
        setPopularProducts(res.data.popularProducts || []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      }
    };

    fetchDashboard();
    const iv = setInterval(fetchDashboard, 5000);

    const onLocalOrder = (e) => {
      // when local order is created, refresh to keep everything consistent
      fetchDashboard();
    };
    window.addEventListener('order:created', onLocalOrder);

    return () => { mounted = false; clearInterval(iv); window.removeEventListener('order:created', onLocalOrder); };
  }, []);

  return (
    <div className="dashboard">
      <main className="main-content">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="logo-container">
            <img src={logo} alt="SalesPoint Logo" className="topbar-logo" />
            <input type="text" placeholder="Search..." />
          </div>
          <div className="top-icons">
            <span className="notification">🔔</span>
            <span className="user">Hello, User</span>
          </div>
        </header>

        {/* Sales Summary */}
        <section className="sales-summary">
          <h3>Today's Sales</h3>
          <div className="summary-cards">
            <div className="card">Total Sales: ₱{summary.totalSales || 0}</div>
            <div className="card">Total Customers: {summary.totalCustomers || 0}</div>
            <div className="card">Total Orders: {summary.totalOrders || 0}</div>
            <div className="card">Average Sale: ₱{summary.avgSale?.toFixed(2) || 0}</div>
          </div>
        </section>

        {/* Sales Record */}
        <section className="sales-record">
          <h3>Sales Record</h3>
          <div className="record-details">
            <div className="record-amount">₱{summary.totalSales || 0}</div>
            <div className="chart-container">
              <DashboardChart weeklySales={weeklySales} recentOrders={recentOrders} />
            </div>
          </div>
        </section>

        {/* Popular Products */}
        <section className="popular-products">
          <h3>Popular Products</h3>
          <div className="product-list">
            {popularProducts.map((p) => (
              <div key={p._id} className="product-card">
                <p>
                  {p.name} - ₱{p.price} ({p.sold} sold)
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Orders */}
        <section className="recent-orders">
          <h3>Recent Orders</h3>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Payment Method</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o._id}>
                  <td>{o.itemName}</td>
                  <td>{o.quantity}</td>
                  <td>₱{o.totalAmount}</td>
                  <td>{o.paymentMethod}</td>
                  <td>{new Date(o.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;