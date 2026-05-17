import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext.jsx";

// Existing Imports
import Navbar from "./components/Navbar";
import PropertyListing from "./components/PropertyListing";
import PropertyDetails from "./components/PropertyDetails";
import InquiryPage from "./components/InquiryModal";
import LoginPage from "./components/LoginPage";
import HostDashboard from "./components/HostDashboard";
import AddProperty from "./components/AddProperty";
import HomePage from "./components/HomePage";
import ChatSystem from "./components/ChatSystem";
import TenantDashboard from "./components/TenantDashboard";
import GlobalAIAssistant from "./components/GlobalAIAssistant";
import SmartAlertsPage from "./components/Smartalertspage";
import AIInsightsPage from "./components/Aiinsightspage";
import LandlordProfile from "./components/LandlordProfile";
import PrivacyCenter from "./components/PrivacyCenter.jsx";

// --- Mobile Shell ---
import MobileBottomNav from "./components/mobile/MobileBottomNav";

// --- Admin Imports ---
import AdminLayout from "./components/AdminLayout";
import AdminOverview from "./components/AdminOverview";
import PropertyModeration from "./components/PropertyModeration";
import UserManagement from "./components/UserManagement";
import SupportAndAI from "./components/SupportAndAI";

// --- Auth-gate Imports ---
import RequireAdmin from "./components/RequireAdmin.jsx";
import RequireAuth from "./components/RequireAuth.jsx";

const AppLayout = () => {
	const location = useLocation();

	// Hide the marketing Navbar on dashboards, auth, admin, and the privacy center
	// (the privacy center has its own header with a back button).
	const hideNavbarRoutes = [
		"/tenant-dashboard",
		"/host-dashboard",
		"/login",
		"/admin",
		"/account",
	];
	const shouldHideNavbar = hideNavbarRoutes.some((route) =>
		location.pathname.startsWith(route),
	);

	// The AI Assistant lives globally but is hidden on auth + admin pages
	// (admins have their own ticket workspace, not the floating widget).
	const isAuthOrAdminPage =
		location.pathname === "/login" || location.pathname.startsWith("/admin");

	// Render the marketing Navbar consistently on every public + content page,
	// including the mobile homepage. This keeps the top-of-page experience
	// (logo + Post + menu drawer) identical regardless of which mobile route
	// the user lands on.
	return (
		<div className="min-h-screen bg-white">
			{!shouldHideNavbar && <Navbar />}

			<Routes>
				{/* Public Routes */}
				<Route path="/" element={<HomePage />} />
				<Route path="/properties/:divisionName" element={<PropertyListing />} />
				<Route path="/property/:id" element={<PropertyDetails />} />
				<Route path="/inquire/:id" element={<InquiryPage />} />
				<Route path="/login" element={<LoginPage />} />

				{/* User/Host Routes */}
				<Route path="/host-dashboard" element={<HostDashboard />} />
				<Route path="/list-property" element={<AddProperty />} />
				<Route path="/messages" element={<ChatSystem />} />
				<Route path="/tenant-dashboard" element={<TenantDashboard />} />
				<Route
					path="/smart-alerts"
					element={
						<RequireAuth>
							<SmartAlertsPage />
						</RequireAuth>
					}
				/>
				<Route path="/ai-insights" element={<AIInsightsPage />} />
				<Route path="/landlord/:id" element={<LandlordProfile />} />

				{/* User account / privacy — requires sign-in */}
				<Route
					path="/account/privacy"
					element={
						<RequireAuth>
							<PrivacyCenter />
						</RequireAuth>
					}
				/>

				{/* Admin Routes — gated by <RequireAdmin> at the layout level so
				    every nested admin path is protected automatically. */}
				<Route
					path="/admin"
					element={
						<RequireAdmin>
							<AdminLayout />
						</RequireAdmin>
					}
				>
					<Route index element={<AdminOverview />} />
					<Route path="properties" element={<PropertyModeration />} />
					<Route path="users" element={<UserManagement />} />
					<Route path="support" element={<SupportAndAI />} />
				</Route>

				{/* 404 catch-all — keeps users from landing on a blank screen when a
				    route doesn't match (e.g. /pricing, /download, /saved, /dashboard
				    referenced from older code that hasn't been wired up yet). */}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>

			{/* Render AI Assistant only if it's not an auth or admin page */}
			{!isAuthOrAdminPage && <GlobalAIAssistant />}

			{/* 📱 Mobile-only bottom navigation rail. md:hidden gated inside the
			    component, plus the AI widget keeps a safe-area-aware offset so
			    the orb doesn't collide with the bar on mobile. */}
			<MobileBottomNav />
		</div>
	);
};

function App() {
	return (
		<AuthProvider>
			<LanguageProvider>
				<Router>
					<AppLayout />
				</Router>
			</LanguageProvider>
		</AuthProvider>
	);
}

export default App;
