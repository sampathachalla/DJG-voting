import { BrowserRouter as Router, Navigate, Route, Routes, useParams } from "react-router-dom";
import Login from "./auth/login";
import Signup from "./auth/signup";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import EventCreatePage from "./pages/Events/EventCreatePage";
import EventDetailPage from "./pages/Events/EventDetailPage";
import EventsListPage from "./pages/Events/EventsListPage";
import FeaturesPage from "./pages/Landing/components/FeaturesPage";
import LandingPage from "./pages/Landing/components/LandingPage";
import SecurityPage from "./pages/Landing/components/SecurityPage";
import SupportPage from "./pages/Landing/components/SupportPage";
function LegacyEventRedirect() {
  const { eventId } = useParams();
  if (!eventId) {
    return <Navigate to="/vote/events" replace />;
  }
  return <Navigate to={`/vote/events/${eventId}`} replace />;
}

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

        <Route path="/observe" element={<Layout mode="app"><EventsListPage /></Layout>} />
        <Route path="/observe/events/:eventId" element={<Layout mode="app"><EventDetailPage /></Layout>} />

        <Route element={<ProtectedRoute />}>
          <Route path="/vote" element={<Layout mode="app"><EventsListPage /></Layout>} />
          <Route path="/vote/events" element={<Layout mode="app"><EventsListPage /></Layout>} />
          <Route path="/vote/events/:eventId" element={<Layout mode="app"><EventDetailPage /></Layout>} />
          <Route path="/organize/events/new" element={<Layout mode="app"><EventCreatePage /></Layout>} />
          <Route path="/organize/events/:eventId" element={<Layout mode="app"><EventDetailPage /></Layout>} />
          <Route path="/organize/events" element={<Navigate to="/observe" replace />} />
          <Route path="/organize" element={<Navigate to="/organize/events/new" replace />} />
        </Route>

        <Route path="/dashboard" element={<Navigate to="/organize/events/new" replace />} />
        <Route path="/events" element={<Navigate to="/vote/events" replace />} />
        <Route path="/events/new" element={<Navigate to="/organize/events/new" replace />} />
        <Route path="/events/:eventId" element={<LegacyEventRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
