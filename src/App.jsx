import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Synthesis from './pages/Synthesis';
import useDeviceDetection from './hooks/useDeviceDetection';
import DesktopView from './components/DesktopView';
import MobileLandscapeView from './components/MobileLandscapeView';
import './App.css';

function App() {
  const deviceState = useDeviceDetection();

  if (deviceState === 'DESKTOP') {
    return <DesktopView />;
  }



  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/synthesis/:id" element={<Synthesis />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
