import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Activities from './pages/Activities.jsx';
import ActivityDetail from './pages/ActivityDetail.jsx';
import Trends from './pages/Trends.jsx';
import Reports from './pages/Reports.jsx';
import Athlete from './pages/Athlete.jsx';
import Calendar from './pages/Calendar.jsx';
import Workouts from './pages/Workouts.jsx';
import Equipment from './pages/Equipment.jsx';
import Import from './pages/Import.jsx';

const NAV = [
  { to: '/', label: '仪表盘', icon: '📊', end: true },
  { to: '/trends', label: '趋势分析', icon: '📈' },
  { to: '/reports', label: '报表', icon: '📑' },
  { to: '/calendar', label: '日历', icon: '📅' },
  { to: '/activities', label: '活动记录', icon: '🏃' },
  { to: '/athlete', label: '运动员', icon: '🧑' },
  { to: '/workouts', label: '训练计划', icon: '📝' },
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
          <Route path="/trends" element={<Trends />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/activities/:id" element={<ActivityDetail />} />
          <Route path="/athlete" element={<Athlete />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/import" element={<Import />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
