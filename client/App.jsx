import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Activities from './pages/Activities.jsx';
import ActivityDetail from './pages/ActivityDetail.jsx';
import Equipment from './pages/Equipment.jsx';
import Import from './pages/Import.jsx';

const NAV = [
  { to: '/', label: '仪表盘', icon: '📊', end: true },
  { to: '/activities', label: '活动记录', icon: '🏃' },
  { to: '/equipment', label: '装备', icon: '🔧' },
  { to: '/import', label: '导入 FIT', icon: '📥' },
];

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">🏃</span>
          <div>
            <div className="name">ActivityLog</div>
            <div className="sub">运动数据分析</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="foot">
          ActivityLog2 Web 版<br />
          Node · React · SQLite
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/activities/:id" element={<ActivityDetail />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/import" element={<Import />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
