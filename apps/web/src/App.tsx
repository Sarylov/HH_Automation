import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { QueuePage } from './pages/QueuePage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/queue" replace />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="applications" element={<ApplicationsPage />} />
      </Route>
    </Routes>
  );
}
