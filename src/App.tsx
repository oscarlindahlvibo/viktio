import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/providers/auth-provider';
import Home from '@/pages/index';
import AppLayout from '@/pages/app-layout';

const Login = lazy(() => import('@/pages/login'));
const Register = lazy(() => import('@/pages/register'));
const Onboarding = lazy(() => import('@/pages/onboarding'));
const Admin = lazy(() => import('@/pages/admin'));
const Integritet = lazy(() => import('@/pages/integritet'));
const Dashboard = lazy(() => import('@/pages/app'));
const Mat = lazy(() => import('@/pages/app-mat'));
const MatSok = lazy(() => import('@/pages/app-mat-sok'));
const MatSkanna = lazy(() => import('@/pages/app-mat-skanna'));
const MatSparade = lazy(() => import('@/pages/app-mat-sparade'));
const MatSparadeDetail = lazy(() => import('@/pages/app-mat-sparade-detail'));
const Profil = lazy(() => import('@/pages/app-profil'));
const Recept = lazy(() => import('@/pages/app-recept'));
const ReceptDetail = lazy(() => import('@/pages/app-recept-detail'));
const Traning = lazy(() => import('@/pages/app-traning'));
const Utveckling = lazy(() => import('@/pages/app-utveckling'));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/integritet" element={<Integritet />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="mat" element={<Mat />} />
              <Route path="mat/sok" element={<MatSok />} />
              <Route path="mat/skanna" element={<MatSkanna />} />
              <Route path="mat/sparade" element={<MatSparade />} />
              <Route path="mat/sparade/:id" element={<MatSparadeDetail />} />
              <Route path="profil" element={<Profil />} />
              <Route path="recept" element={<Recept />} />
              <Route path="recept/:id" element={<ReceptDetail />} />
              <Route path="traning" element={<Traning />} />
              <Route path="utveckling" element={<Utveckling />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster position="top-center" />
      </AuthProvider>
    </BrowserRouter>
  );
}
