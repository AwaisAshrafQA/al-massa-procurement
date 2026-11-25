import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Spinner } from "@/components/ui";
import { homeFor, useAuth } from "@/lib/auth";
import { Board } from "@/pages/Board";
import { Dashboard } from "@/pages/Dashboard";
import { Inbox } from "@/pages/Inbox";
import { Login } from "@/pages/Login";
import { MyRequests } from "@/pages/MyRequests";
import { RequestDetail } from "@/pages/RequestDetail";
import { RequestForm } from "@/pages/RequestForm";

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function Home() {
  const { me } = useAuth();
  return <Navigate to={me ? homeFor(me) : "/login"} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="/overview" element={<Dashboard />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/board" element={<Board />} />
        <Route path="/requests" element={<MyRequests />} />
        <Route path="/requests/new" element={<RequestForm />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/requests/:id/edit" element={<RequestForm />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
