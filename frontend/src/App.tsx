import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.tsx';
import CallbackPage from './pages/CallbackPage.tsx';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/api/spotify/callback" element={<CallbackPage />} />
      </Routes>
    </Router>
  );
};

export default App;