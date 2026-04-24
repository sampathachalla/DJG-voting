import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./auth/login";
import Signup from "./auth/signup";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import EventCreatePage from "./pages/Events/EventCreatePage";
import EventDetailPage from "./pages/Events/EventDetailPage";
import EventsListPage from "./pages/Events/EventsListPage";
import FeaturesPage from "./pages/Landing/components/FeaturesPage";
import LandingPage from "./pages/Landing/components/LandingPage";
import SecurityPage from "./pages/Landing/components/SecurityPage";
import SupportPage from "./pages/Landing/components/SupportPage";
function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
          <Layout>
            <LandingPage />
          </Layout>
          }
        />
        <Route path="/features" element={<Layout><FeaturesPage /></Layout>} />
        <Route path="/security" element={<Layout><SecurityPage /></Layout>} />
        <Route path="/support" element={<Layout><SupportPage /></Layout>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Layout mode="app"><DashboardPage /></Layout>} />
          <Route path="/events" element={<Layout mode="app"><EventsListPage /></Layout>} />
          <Route path="/events/new" element={<Layout mode="app"><EventCreatePage /></Layout>} />
          <Route path="/events/:eventId" element={<Layout mode="app"><EventDetailPage /></Layout>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
