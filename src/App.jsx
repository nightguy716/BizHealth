import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Navbar    from './components/Navbar';
import Landing   from './pages/Landing';
import Dashboard from './pages/Dashboard';
import About     from './pages/About';
import Pricing   from './pages/Pricing';
import Contact   from './pages/Contact';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      {/* pt-14 offsets the fixed navbar height */}
      <div className="pt-14">
        <Routes>
          <Route path="/"          element={<Landing />}   />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about"     element={<About />}     />
          <Route path="/pricing"   element={<Pricing />}   />
          <Route path="/contact"   element={<Contact />}   />
          {/* Fallback — redirect unknown paths to landing */}
          <Route path="*"          element={<Landing />}   />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
