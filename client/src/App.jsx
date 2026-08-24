import { useEffect, useState } from 'react';
import { ArrowRight, Bell, Clock3, MapPin, Utensils } from 'lucide-react';
import { getHealth } from './services/api.js';

const vendors = [
  { name: 'Vovo Telo', detail: 'Bakery & cafe', time: '10-15 min', tone: 'coral' },
  { name: 'Fresh at First', detail: 'Fresh meals', time: '15-20 min', tone: 'mint' },
  { name: 'Staff Cafeteria', detail: '1 Merchant Place', time: '10-18 min', tone: 'blue' }
];

export default function App() {
  const [apiStatus, setApiStatus] = useState('Checking connection');

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus('Connected to Merchant Munchies API'))
      .catch(() => setApiStatus('API is waiting to connect'));
  }, []);

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Merchant Munchies home">
          <span className="brand-mark"><Utensils size={18} strokeWidth={2.5} /></span>
          <span>Merchant <strong>Munchies</strong></span>
        </a>
        <button className="icon-button" type="button" aria-label="Notifications" title="Notifications">
          <Bell size={19} />
        </button>
      </nav>

      <section className="hero-section">
        <div>
          <p className="eyebrow">Merchant Place / Today</p>
          <h1>Good food,<br /><em>less queue.</em></h1>
          <p className="hero-copy">Order ahead, choose your collection time, and get your lunch break back.</p>
          <div className="location-pill"><MapPin size={16} /><span>1 Merchant Place</span><ArrowRight size={15} /></div>
        </div>
        <div className="hero-illustration" aria-hidden="true"><span>MM</span></div>
      </section>

      <section className="content-section" aria-labelledby="nearby-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Ready when you are</p><h2 id="nearby-heading">Order from nearby</h2></div>
          <a href="#vendors">View all</a>
        </div>
        <div className="vendor-grid" id="vendors">
          {vendors.map((vendor) => (
            <article className="vendor-card" key={vendor.name}>
              <div className={`vendor-image ${vendor.tone}`}><Utensils size={25} /></div>
              <div className="vendor-card-body"><div><h3>{vendor.name}</h3><p>{vendor.detail}</p></div><span className="time"><Clock3 size={13} />{vendor.time}</span></div>
            </article>
          ))}
        </div>
      </section>

      <footer className="status-bar"><span className="status-dot" />{apiStatus}</footer>
    </main>
  );
}
