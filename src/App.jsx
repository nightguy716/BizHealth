import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Navbar    from './components/Navbar';
import Landing   from './pages/Landing';
import Dashboard from './pages/Dashboard';
import About     from './pages/About';
import Pricing   from './pages/Pricing';
import Contact   from './pages/Contact';
import Auth      from './pages/Auth';
import Profile   from './pages/Profile';
import Blog      from './pages/Blog';
import BlogPost  from './pages/BlogPost';

function BackendWarmup() {
  useEffect(() => {
    const url = import.meta.env.VITE_BACKEND_URL;
    if (!url) return;
    // Fire immediately on any page load
    fetch(`${url}/ping`).catch(() => {});
    // Then keep it warm every 10 minutes while the tab is open
    const id = setInterval(() => fetch(`${url}/ping`).catch(() => {}), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <BackendWarmup />
      <Navbar />
      {/* pt-14 offsets the fixed navbar height */}
      <div className="pt-14">
        <Routes>
          <Route path="/"          element={<Landing />}   />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about"     element={<About />}     />
          <Route path="/pricing"   element={<Pricing />}   />
          <Route path="/contact"   element={<Contact />}   />
          <Route path="/auth"        element={<Auth />}      />
          <Route path="/profile"     element={<Profile />}   />
          <Route path="/blog"        element={<Blog />}      />
          <Route path="/blog/:slug"  element={<BlogPost />}  />
          {/* Fallback — redirect unknown paths to landing */}
          <Route path="*"            element={<Landing />}   />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
