import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import Jobs from "./pages/Jobs.tsx";
import JobDetail from "./pages/JobDetail.tsx";
import Apparel from "./pages/Apparel.tsx";
import Dispatch from "./pages/Dispatch.tsx";
import Referrals from "./pages/Referrals.tsx";
import TimeOff from "./pages/TimeOff.tsx";
import Schedule from "./pages/Schedule.tsx";
import Tools from "./pages/Tools.tsx";
import TruckingCalculator from "./pages/TruckingCalculator.tsx";
import PerformanceReviews from "./pages/PerformanceReviews.tsx";
import Handbook from "./pages/Handbook.tsx";
import MyPosition from "./pages/MyPosition.tsx";
import Vendors from "./pages/Vendors.tsx";
import EmployeeContacts from "./pages/EmployeeContacts.tsx";
import Perks from "./pages/Perks.tsx";
import OrgChart from "./pages/OrgChart.tsx";
import AdminPositions from "./pages/AdminPositions.tsx";
import HR from "./pages/HR.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import Safety from "./pages/Safety.tsx";
import EquipmentRental from "./pages/EquipmentRental.tsx";
import ShopBooking from "./pages/ShopBooking.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
            <Route path="/apparel" element={<ProtectedRoute><Apparel /></ProtectedRoute>} />
            <Route path="/dispatch" element={<ProtectedRoute><Dispatch /></ProtectedRoute>} />
            <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
            <Route path="/time-off" element={<ProtectedRoute><TimeOff /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
            <Route path="/tools/trucking" element={<ProtectedRoute><TruckingCalculator /></ProtectedRoute>} />
            <Route path="/tools/performance-reviews" element={<ProtectedRoute><PerformanceReviews /></ProtectedRoute>} />
            <Route path="/tools/handbook" element={<ProtectedRoute><Handbook /></ProtectedRoute>} />
            <Route path="/my-position" element={<ProtectedRoute><MyPosition /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
            <Route path="/employee-contacts" element={<ProtectedRoute><EmployeeContacts /></ProtectedRoute>} />
            <Route path="/perks" element={<ProtectedRoute><Perks /></ProtectedRoute>} />
            <Route path="/org-chart" element={<ProtectedRoute><OrgChart /></ProtectedRoute>} />
            <Route
              path="/admin/positions"
              element={<ProtectedRoute requireRole="admin"><AdminPositions /></ProtectedRoute>}
            />
            <Route
              path="/hr"
              element={<ProtectedRoute requireRole="admin"><HR /></ProtectedRoute>}
            />
            <Route
              path="/admin/users"
              element={<ProtectedRoute requireRole="admin"><AdminUsers /></ProtectedRoute>}
            />
            <Route path="/safety" element={<ProtectedRoute><Safety /></ProtectedRoute>} />
            <Route path="/equipment-rental" element={<ProtectedRoute><EquipmentRental /></ProtectedRoute>} />
            <Route path="/shop-booking" element={<ProtectedRoute><ShopBooking /></ProtectedRoute>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
