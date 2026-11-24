import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import FeatureIntro from './pages/FeatureIntro';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Attendance from './pages/Attendance';
import Payments from './pages/Payments';
import Tasks from './pages/Tasks';
import CustomSection from './pages/CustomSection';
import ModulesStudio from './pages/ModulesStudio';
import FormBuilder from './pages/FormBuilder';
import WorkflowsPage from './pages/WorkflowsPage';
import BillingPage from './pages/BillingPage';
import AdminPage from './pages/AdminPage';
import AccountPage from './pages/AccountPage';
import BatchesPage from './pages/BatchesPage';
import InstructorsPage from './pages/InstructorsPage';
import ReportsPage from './pages/ReportsPage';
import MessagesPage from './pages/MessagesPage';
import RecycleBinPage from './pages/RecycleBinPage';
import ParentPortal from './pages/ParentPortal';
import InviteAccept from './pages/InviteAccept';
import PublicFormPage from './pages/PublicFormPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/parent" element={<ParentPortal />} />
      <Route path="/invite/:token" element={<InviteAccept />} />
      <Route path="/f/:token" element={<PublicFormPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute allowIncomplete>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feature-intro"
        element={
          <ProtectedRoute allowIncomplete>
            <FeatureIntro />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="instructors" element={<InstructorsPage />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payments" element={<Payments />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="modules" element={<ModulesStudio />} />
        <Route path="modules/:moduleId/sections/:sectionId" element={<CustomSection />} />
        <Route path="forms" element={<FormBuilder />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="recycle-bin" element={<RecycleBinPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
