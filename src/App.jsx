import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Synthesis from './pages/Synthesis';
import SmilesRenderer from './pages/SmilesRenderer';
import useDeviceDetection from './hooks/useDeviceDetection';

import MobileLandscapeView from './components/MobileLandscapeView';
import './App.css';

function App() {
  const deviceState = useDeviceDetection();





  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/synthesis/:id" element={<Synthesis />} />
          <Route path="/render" element={<SmilesRenderer />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
