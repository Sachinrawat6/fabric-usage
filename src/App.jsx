import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FabricStockTracker from './pages/FabricConsumption';
import StyleRecords from './pages/Orders';
import Sidebar from './components/Sidebar';

const App = () => {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1  overflow-y-auto min-w-0">
          <Routes>
            <Route path="/" element={<FabricStockTracker />} />
            <Route path="/by-stylenumbers" element={<StyleRecords />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
