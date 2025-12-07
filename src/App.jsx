import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Synthesis from './pages/Synthesis';
import './App.css'

function App() {
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
