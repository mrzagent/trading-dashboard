import { HashRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Strategies from "./pages/Strategies";
import "./App.css";

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/strategies" element={<Strategies />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
