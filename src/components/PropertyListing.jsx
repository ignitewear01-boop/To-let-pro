import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Search, MapPin, BedDouble, Bath, Square, Heart, Star, X, ChevronRight, ShieldCheck, ChevronDown, ChevronUp, Filter, Ruler, Navigation, CheckCircle2, Flame, Building, Wifi, Map, List, LayoutGrid, Home, Users, User, BookOpen, Share2, MessageCircle, ArrowLeft, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
// ─── SHARED INQUIRY MODAL (single source of truth for the inquiry flow) ───────
import InquiryModal from "./InquiryModal";

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  GOOGLE MAPS                                                            ║
// ║                                                                         ║
// ║  Install once at the project root:                                      ║
// ║      npm i @react-google-maps/api                                       ║
// ║                                                                         ║
// ║  Add a Maps JavaScript API key to .env (depending on your bundler):     ║
// ║      Vite : VITE_GOOGLE_MAPS_API_KEY=AIza...                            ║
// ║      CRA  : REACT_APP_GOOGLE_MAPS_API_KEY=AIza...                       ║
// ║                                                                         ║
// ║  Behaviour:                                                             ║
// ║    • If the key is present → interactive Google Map with custom price   ║
// ║      chip markers and click → MapMiniCard popup (matches the design     ║
// ║      reference videos for desktop & mobile).                            ║
// ║    • If the key is missing → graceful iframe fallback so dev work isn't ║
// ║      blocked. This uses the public /maps embed (no key required).       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { GoogleMap, OverlayView, OverlayViewF, useJsApiLoader } from "@react-google-maps/api";

// Pull the API key from whichever bundler the host project uses. Comment the
// line that does NOT match your build tool — the other line stays.
const GOOGLE_MAPS_API_KEY =
	(typeof import.meta !== "undefined" && import.meta?.env?.VITE_GOOGLE_MAPS_API_KEY) ||
	(typeof process !== "undefined" && process?.env?.REACT_APP_GOOGLE_MAPS_API_KEY) ||
	"AIzaSyC9xWNjjSPhxy2aUWLubPqHR7N6KZWmKlg";

// Loaded libraries (kept as a stable reference for useJsApiLoader).
// Add 'places' / 'geometry' here if you wire up auto-complete or distance calcs.
const GOOGLE_MAPS_LIBRARIES = [];

// Default centre — middle of Dhaka. Override via the prop on <MapView />.
const DEFAULT_MAP_CENTER = { lat: 23.7652, lng: 90.3893 };
const DEFAULT_MAP_ZOOM = 12;

// Light, Voyager-like map styling that mirrors the reference screenshots.
const MAP_STYLES = [
	{ featureType: "poi.business", stylers: [{ visibility: "off" }] },
	{ featureType: "poi.attraction", elementType: "labels", stylers: [{ visibility: "off" }] },
	{ featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  BACK-END MIGRATION                                                     ║
// ║  When your API is ready:                                                ║
// ║    1. Delete `propertiesData` and `landlordsData` below.                ║
// ║    2. In PropertyListing component, replace the direct array usage with ║
// ║       calls to propertyService.getProperties(filters, sortBy) inside    ║
// ║       a useEffect + useState pair.                                      ║
// ║    3. The filter logic already maps 1:1 to the service helper.          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// TODO (backend): replace the local `propertiesData` constant below with a
// real fetch. Suggested shape using react-query:
//
//   const { data: properties = [] } = useQuery(
//     ['properties', filters, sortBy],
//     () => api.get('/api/properties', { params: { ...filters, sortBy } })
//                .then(r => r.data)
//   );
//
// The shape consumed by <MapView /> and <PropertyCard /> is:
//   { id, title, location, price, lat, lng, image, beds, baths, sqft,
//     rating, reviews, ...filters }
const propertiesData = [
	{
		id: 1,
		landlordId: 1,
		date: "2026-04-20",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "family",
		title: "Luxurious 4BHK Family Flat in Gulshan",
		location: "Road 12, Gulshan 2, Dhaka",
		beds: 4,
		baths: 4,
		sqft: 2500,
		furnishing: "Furnished",
		price: 120000,
		originalPrice: 135000,
		rating: 4.8,
		reviews: 124,
		verified: true,
		lat: 23.7925,
		lng: 90.4078,
		popularity: 95,
		inquiries: 7,
		images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800", "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=800", "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800"],
	},
	{
		id: 2,
		landlordId: 1,
		date: "2026-04-21",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "family",
		title: "Premium 3BHK Family Apartment in Banani",
		location: "Block C, Banani, Dhaka",
		beds: 3,
		baths: 3,
		sqft: 1800,
		furnishing: "Semi-Furnished",
		price: 85000,
		originalPrice: 95000,
		rating: 4.5,
		reviews: 89,
		verified: true,
		lat: 23.7937,
		lng: 90.4066,
		popularity: 88,
		inquiries: 12,
		images: ["https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=800", "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800"],
	},
	{
		id: 3,
		landlordId: 2,
		date: "2026-04-18",
		division: "chittagong",
		type: "apartment",
		rentalCategory: "family",
		title: "Sea View Apartment in Agrabad",
		location: "Agrabad C/A, Chattogram",
		beds: 3,
		baths: 2,
		sqft: 1500,
		furnishing: "Unfurnished",
		price: 45000,
		originalPrice: 50000,
		rating: 4.7,
		reviews: 210,
		verified: true,
		lat: 22.3303,
		lng: 91.8184,
		popularity: 90,
		inquiries: 3,
		images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800", "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=800"],
	},
	{
		id: 4,
		landlordId: 2,
		date: "2026-04-22",
		division: "dhaka",
		type: "studio",
		rentalCategory: "bachelor_male",
		title: "Modern Studio for Male Bachelors – Mirpur",
		location: "Section 10, Mirpur, Dhaka",
		beds: 1,
		baths: 1,
		sqft: 420,
		furnishing: "Furnished",
		price: 12000,
		originalPrice: 14000,
		rating: 4.2,
		reviews: 45,
		verified: true,
		lat: 23.8103,
		lng: 90.3617,
		popularity: 72,
		inquiries: 18,
		images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800", "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800"],
	},
	{
		id: 5,
		landlordId: 3,
		date: "2026-04-23",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "bachelor_female",
		title: "Safe 2BHK for Female Bachelors – Dhanmondi",
		location: "Road 27, Dhanmondi, Dhaka",
		beds: 2,
		baths: 2,
		sqft: 900,
		furnishing: "Semi-Furnished",
		price: 28000,
		originalPrice: 32000,
		rating: 4.6,
		reviews: 67,
		verified: true,
		lat: 23.7461,
		lng: 90.3742,
		popularity: 82,
		inquiries: 9,
		images: ["https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=800", "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=800"],
	},
	{
		id: 6,
		landlordId: 3,
		date: "2026-04-19",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "sublet",
		title: "Sublet Room – Bashundhara R/A",
		location: "Block D, Bashundhara, Dhaka",
		beds: 1,
		baths: 1,
		sqft: 320,
		furnishing: "Furnished",
		price: 8500,
		originalPrice: 9500,
		rating: 4.0,
		reviews: 33,
		verified: false,
		lat: 23.8135,
		lng: 90.4245,
		popularity: 65,
		inquiries: 22,
		images: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800"],
	},
	{
		id: 7,
		landlordId: 1,
		date: "2026-04-17",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "student",
		title: "Student Mess Near Dhaka University",
		location: "Nilkhet, Dhaka",
		beds: 1,
		baths: 1,
		sqft: 280,
		furnishing: "Furnished",
		price: 6000,
		originalPrice: 7000,
		rating: 4.1,
		reviews: 88,
		verified: true,
		lat: 23.7288,
		lng: 90.4023,
		popularity: 78,
		inquiries: 30,
		images: ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800"],
	},
	{
		id: 8,
		landlordId: 1,
		date: "2026-04-25",
		division: "dhaka",
		type: "penthouse",
		rentalCategory: "family",
		title: "Sky Penthouse – Uttara Sector 13",
		location: "Sector 13, Uttara, Dhaka",
		beds: 5,
		baths: 5,
		sqft: 4000,
		furnishing: "Furnished",
		price: 250000,
		originalPrice: 280000,
		rating: 4.9,
		reviews: 41,
		verified: true,
		lat: 23.8759,
		lng: 90.3795,
		popularity: 98,
		inquiries: 5,
		images: ["https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?q=80&w=800", "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?q=80&w=800"],
	},
	{
		id: 9,
		landlordId: 2,
		date: "2026-04-16",
		division: "dhaka",
		type: "duplex",
		rentalCategory: "family",
		title: "Spacious Duplex Villa – Baridhara",
		location: "Baridhara DOHS, Dhaka",
		beds: 5,
		baths: 4,
		sqft: 3600,
		furnishing: "Semi-Furnished",
		price: 180000,
		originalPrice: 200000,
		rating: 4.7,
		reviews: 55,
		verified: true,
		lat: 23.8006,
		lng: 90.4283,
		popularity: 91,
		inquiries: 4,
		images: ["https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=800"],
	},
	{
		id: 10,
		landlordId: 3,
		date: "2026-04-24",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "bachelor_male",
		title: "Bachelor Flat – Mohammadpur",
		location: "Mohammadpur Housing, Dhaka",
		beds: 2,
		baths: 1,
		sqft: 750,
		furnishing: "Unfurnished",
		price: 16000,
		originalPrice: 18000,
		rating: 4.0,
		reviews: 28,
		verified: false,
		lat: 23.7646,
		lng: 90.3585,
		popularity: 60,
		inquiries: 14,
		images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800"],
	},
	{
		id: 11,
		landlordId: 1,
		date: "2026-04-15",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "family",
		title: "Cozy 3BHK – Azimpur Colony",
		location: "Azimpur, Lalbagh, Dhaka",
		beds: 3,
		baths: 2,
		sqft: 1200,
		furnishing: "Unfurnished",
		price: 22000,
		originalPrice: 25000,
		rating: 4.3,
		reviews: 76,
		verified: true,
		lat: 23.7233,
		lng: 90.3897,
		popularity: 74,
		inquiries: 8,
		images: ["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=800"],
	},
	{
		id: 12,
		landlordId: 3,
		date: "2026-04-26",
		division: "dhaka",
		type: "studio",
		rentalCategory: "sublet",
		title: "Sublet Studio – Farmgate",
		location: "Farmgate, Tejgaon, Dhaka",
		beds: 1,
		baths: 1,
		sqft: 380,
		furnishing: "Furnished",
		price: 10000,
		originalPrice: 11500,
		rating: 3.9,
		reviews: 22,
		verified: false,
		lat: 23.7588,
		lng: 90.3896,
		popularity: 55,
		inquiries: 20,
		images: ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800"],
	},
	{
		id: 13,
		landlordId: 2,
		date: "2026-04-14",
		division: "chittagong",
		type: "apartment",
		rentalCategory: "family",
		title: "Hill-view 3BHK – Nasirabad",
		location: "Nasirabad H/S, Chattogram",
		beds: 3,
		baths: 3,
		sqft: 1600,
		furnishing: "Semi-Furnished",
		price: 38000,
		originalPrice: 43000,
		rating: 4.5,
		reviews: 90,
		verified: true,
		lat: 22.3659,
		lng: 91.8246,
		popularity: 83,
		inquiries: 6,
		images: ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800"],
	},
	{
		id: 14,
		landlordId: 1,
		date: "2026-04-27",
		division: "sylhet",
		type: "independent",
		rentalCategory: "family",
		title: "Independent House – Sylhet Sadar",
		location: "Zindabazar, Sylhet",
		beds: 4,
		baths: 3,
		sqft: 2200,
		furnishing: "Unfurnished",
		price: 30000,
		originalPrice: 35000,
		rating: 4.4,
		reviews: 60,
		verified: true,
		lat: 24.8949,
		lng: 91.8687,
		popularity: 77,
		inquiries: 9,
		images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800"],
	},
	{
		id: 15,
		landlordId: 2,
		date: "2026-04-13",
		division: "rajshahi",
		type: "apartment",
		rentalCategory: "student",
		title: "Student Room Near RU Campus",
		location: "Binodpur, Rajshahi",
		beds: 1,
		baths: 1,
		sqft: 250,
		furnishing: "Furnished",
		price: 5500,
		originalPrice: 6500,
		rating: 4.0,
		reviews: 105,
		verified: false,
		lat: 24.3745,
		lng: 88.6042,
		popularity: 70,
		inquiries: 35,
		images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800"],
	},
	{
		id: 16,
		landlordId: 3,
		date: "2026-04-28",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "bachelor_female",
		title: "Ladies-only Flat – Rayer Bazar",
		location: "Rayer Bazar, Dhanmondi, Dhaka",
		beds: 2,
		baths: 1,
		sqft: 700,
		furnishing: "Semi-Furnished",
		price: 19000,
		originalPrice: 21000,
		rating: 4.4,
		reviews: 48,
		verified: true,
		lat: 23.753,
		lng: 90.362,
		popularity: 80,
		inquiries: 11,
		images: ["https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=800"],
	},
	{
		id: 17,
		landlordId: 1,
		date: "2026-04-12",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "family",
		title: "Elegant 3BHK – Niketan, Gulshan",
		location: "Niketan, Gulshan 1, Dhaka",
		beds: 3,
		baths: 3,
		sqft: 1900,
		furnishing: "Furnished",
		price: 95000,
		originalPrice: 108000,
		rating: 4.6,
		reviews: 73,
		verified: true,
		lat: 23.782,
		lng: 90.402,
		popularity: 87,
		inquiries: 6,
		images: ["https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=800"],
	},
	{
		id: 18,
		landlordId: 2,
		date: "2026-04-29",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "bachelor_male",
		title: "Male Bachelor Flat – Shyamoli",
		location: "Shyamoli, Mohammadpur, Dhaka",
		beds: 2,
		baths: 1,
		sqft: 800,
		furnishing: "Unfurnished",
		price: 14500,
		originalPrice: 16000,
		rating: 3.8,
		reviews: 19,
		verified: false,
		lat: 23.7743,
		lng: 90.362,
		popularity: 58,
		inquiries: 16,
		images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800"],
	},
	{
		id: 19,
		landlordId: 3,
		date: "2026-04-11",
		division: "khulna",
		type: "independent",
		rentalCategory: "family",
		title: "Corner Family House – Sonadanga",
		location: "Sonadanga, Khulna",
		beds: 4,
		baths: 3,
		sqft: 2000,
		furnishing: "Unfurnished",
		price: 25000,
		originalPrice: 28000,
		rating: 4.3,
		reviews: 38,
		verified: true,
		lat: 22.8456,
		lng: 89.5403,
		popularity: 68,
		inquiries: 5,
		images: ["https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=800"],
	},
	{
		id: 20,
		landlordId: 3,
		date: "2026-04-30",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "sublet",
		title: "Sublet Room – Wari, Old Dhaka",
		location: "Wari, Dhaka South",
		beds: 1,
		baths: 1,
		sqft: 300,
		furnishing: "Semi-Furnished",
		price: 7500,
		originalPrice: 8500,
		rating: 3.7,
		reviews: 15,
		verified: false,
		lat: 23.7185,
		lng: 90.4125,
		popularity: 48,
		inquiries: 25,
		images: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800"],
	},
	{
		id: 21,
		landlordId: 1,
		date: "2026-05-01",
		division: "dhaka",
		type: "apartment",
		rentalCategory: "family",
		title: "Brand New 4BHK – Aftabnagar",
		location: "Aftabnagar, Rampura, Dhaka",
		beds: 4,
		baths: 3,
		sqft: 2100,
		furnishing: "Semi-Furnished",
		price: 65000,
		originalPrice: 72000,
		rating: 4.5,
		reviews: 32,
		verified: true,
		lat: 23.7633,
		lng: 90.4342,
		popularity: 84,
		inquiries: 10,
		images: ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800"],
	},
	{
		id: 22,
		landlordId: 2,
		date: "2026-05-02",
		division: "dhaka",
		type: "studio",
		rentalCategory: "student",
		title: "Compact Student Studio – Jigatola",
		location: "Jigatola, Dhanmondi, Dhaka",
		beds: 1,
		baths: 1,
		sqft: 350,
		furnishing: "Furnished",
		price: 9000,
		originalPrice: 10000,
		rating: 4.2,
		reviews: 55,
		verified: true,
		lat: 23.7398,
		lng: 90.3801,
		popularity: 69,
		inquiries: 19,
		images: ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800"],
	},
];

// ─── LANDLORD LOOKUP (minimal — for modal display) ────────────────────────────
// In production this comes from your API/context. Keep in sync with PropertyDetails.
const landlordsData = {
	1: { id: 1, name: "Rahman Syndicate", responseTime: "< 1 hour", avatar: "https://ui-avatars.com/api/?name=Rahman+Syndicate&background=fce4ec&color=ba0036&size=256" },
	2: { id: 2, name: "Karim Properties", responseTime: "< 2 hours", avatar: "https://ui-avatars.com/api/?name=Karim+Properties&background=e8f5e9&color=2e7d32&size=256" },
	3: { id: 3, name: "Hossain Real Estate", responseTime: "< 4 hours", avatar: "https://ui-avatars.com/api/?name=Hossain+RE&background=fff3e0&color=e65100&size=256" },
};

// ─── RENTAL CATEGORY CONFIG ──────────────────────────────────────────────────
// ⚠️  IDs must match `rentalCategory` values in demo data + propertyService.js
//     AND the category IDs used by HeroSection / Navbar dropdowns.
// Each category exposes a translation key (`tKey`) that the UI resolves at
// render time via `t[cat.tKey]`. The English fallback (`label`) is also used
// directly inside the OYO map mini-card where translation isn't available.
const RENTAL_CATEGORIES = [
	{ id: "family",          label: "Family Flat",       tKey: "catFamilyFlat",     icon: Home },
	{ id: "bachelor_male",   label: "Bachelor (Male)",   tKey: "catBachelorMale",   icon: User },
	{ id: "bachelor_female", label: "Bachelor (Female)", tKey: "catBachelorFemale", icon: Users },
	{ id: "sublet",          label: "Sublet / Room",     tKey: "catSubletRoom",     icon: Share2 },
	{ id: "student",         label: "Student",           tKey: "catStudent",        icon: BookOpen },
];

// ─── VALID DIVISIONS (To catch custom area searches) ──────────────────────────
const validDivisions = ["dhaka", "chittagong", "sylhet", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh"];

// ─── PROPERTY CARD ────────────────────────────────────────────────────────────
const PropertyCard = ({ property, navigate, t, showToast, isHighlighted, onHover, onHoverEnd, onInquire }) => {
	const [isSaved, setIsSaved] = useState(false);

	useEffect(() => {
		const savedProps = JSON.parse(localStorage.getItem("savedProperties") || "[]");
		setIsSaved(savedProps.some((p) => p.id === property.id));
	}, [property.id]);

	const handleSave = (e) => {
		e.preventDefault();
		e.stopPropagation();
		let savedProps = JSON.parse(localStorage.getItem("savedProperties") || "[]");
		const isCurrentlySaved = savedProps.some((p) => p.id === property.id);
		if (isCurrentlySaved) {
			savedProps = savedProps.filter((p) => p.id !== property.id);
			setIsSaved(false);
			showToast("Removed from Saved");
		} else {
			savedProps.push({ id: property.id, title: property.title, location: property.location, price: property.price.toString(), beds: property.beds, baths: property.baths, img: property.images[0] });
			setIsSaved(true);
			showToast("Property Saved Successfully!");
		}
		localStorage.setItem("savedProperties", JSON.stringify(savedProps));
	};

	const discountPercent = Math.round(((property.originalPrice - property.price) / property.originalPrice) * 100);
	const catEntry = RENTAL_CATEGORIES.find((c) => c.id === property.rentalCategory);
	const catLabel = (catEntry?.tKey && t[catEntry.tKey]) || catEntry?.label || "Others";

	return (
		<div onMouseEnter={() => onHover && onHover(property.id)} onMouseLeave={() => onHoverEnd && onHoverEnd()} className={`bg-white rounded-[2rem] border overflow-hidden flex flex-col md:flex-row hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 group ${isHighlighted ? "border-brandRed shadow-[0_0_0_2px_rgba(186,0,54,0.3)]" : "border-gray-100"}`}>
			<div className="w-full md:w-[380px] lg:w-[400px] h-[260px] md:h-auto p-3 shrink-0">
				<div className="relative w-full h-full rounded-[1.5rem] overflow-hidden flex gap-1.5 bg-gray-100">
					<div className="relative w-[75%] h-full overflow-hidden cursor-pointer" onClick={() => navigate(`/property/${property.id}`)}>
						<img src={property.images[0]} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" />
						<div className="absolute top-3 left-3 flex flex-col gap-2 items-start">
							{property.verified && (
								<div className="bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm text-[10px] font-black text-brandRed">
									<ShieldCheck size={12} /> {t.verified || "Verified"}
								</div>
							)}
							<span className="bg-brandRed/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-sm">{catLabel}</span>
						</div>
						<button onClick={handleSave} className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-md rounded-full hover:bg-white hover:scale-110 active:scale-95 transition-all z-20 shadow-sm">
							<Heart size={16} className={isSaved ? "fill-brandRed text-brandRed" : "text-gray-700"} />
						</button>
					</div>
					<div className="w-[25%] flex flex-col gap-1.5 h-full">
						{property.images.slice(1, 4).map((img, idx) => (
							<div key={idx} className="relative flex-1 overflow-hidden cursor-pointer bg-gray-200" onClick={() => navigate(`/property/${property.id}`)}>
								<img src={img} className="w-full h-full object-cover hover:opacity-80 transition-opacity duration-300" alt="" />
								{idx === 2 && property.images.length > 4 && <div className="absolute inset-0 bg-brandRed/80 backdrop-blur-sm flex items-center justify-center text-white text-xs font-black">+{property.images.length - 4}</div>}
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="p-5 md:p-6 flex-1 flex flex-col justify-between">
				<div>
					<div className="flex justify-between items-start gap-4 mb-3">
						<div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/property/${property.id}`)}>
							<div className="bg-gray-900 text-white text-[11px] font-black px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
								<Star size={10} className="fill-yellow-400 text-yellow-400" /> {property.rating}
							</div>
							<span className="text-xs font-bold text-gray-400 hover:text-brandRed transition-colors">
								{property.reviews} {t.reviews || "Reviews"}
							</span>
						</div>
						<div className="hidden md:flex bg-red-50 px-2.5 py-1 rounded-lg items-center gap-1">
							<Flame size={12} className="fill-brandRed text-brandRed" />
							<span className="text-[10px] font-black text-brandRed uppercase tracking-widest">
								{property.inquiries} {t.inquiriesToday || "Inquiries Today"}
							</span>
						</div>
					</div>
					<h3 className="text-xl md:text-2xl font-black text-gray-900 leading-tight group-hover:text-brandRed transition-colors cursor-pointer mb-2" onClick={() => navigate(`/property/${property.id}`)}>
						{property.title}
					</h3>
					<p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-5">
						<MapPin size={14} className="text-gray-400" /> {property.location}
					</p>
					<div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-600 bg-gray-50 p-3 rounded-2xl">
						<span className="flex items-center gap-1.5">
							<BedDouble size={14} className="text-gray-400" /> {property.beds} {t.beds || "Beds"}
						</span>
						<span className="flex items-center gap-1.5">
							<Bath size={14} className="text-gray-400" /> {property.baths} {t.baths || "Baths"}
						</span>
						<span className="flex items-center gap-1.5">
							<Square size={14} className="text-gray-400" /> {property.sqft} {t.sqft || "sqft"}
						</span>
						<span className="hidden sm:flex items-center gap-1.5">
							<Building size={14} className="text-gray-400" />
							{property.furnishing === "Furnished" ? t.furnished || "Furnished" : property.furnishing === "Semi-Furnished" ? t.semiFurnished || "Semi-Furnished" : t.unfurnished || "Unfurnished"}
						</span>
					</div>
				</div>
				<div className="flex flex-col sm:flex-row justify-between items-end gap-4 pt-5 mt-5 border-t border-gray-100">
					<div className="w-full sm:w-auto flex flex-col cursor-pointer" onClick={() => navigate(`/property/${property.id}`)}>
						<div className="flex items-baseline gap-2">
							<span className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter">৳ {property.price.toLocaleString("en-IN")}</span>
							{property.originalPrice > property.price && (
								<div className="flex items-center gap-2">
									<span className="text-xs text-gray-400 line-through font-bold">৳ {property.originalPrice.toLocaleString("en-IN")}</span>
									<span className="bg-green-100 text-green-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
										{discountPercent}% {t.off || "Off"}
									</span>
								</div>
							)}
						</div>
						<p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{t.perMonthExcluding || "Per Month • Excluding Utilities"}</p>
					</div>
					<div className="flex items-center gap-3 w-full sm:w-auto">
						<button onClick={() => navigate(`/property/${property.id}`)} className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all">
							{t.detailsBtn || "Details"}
						</button>
						{/* ── INQUIRY BUTTON: opens modal inline, no page navigation ── */}
						<button
							onClick={(e) => {
								e.stopPropagation();
								onInquire(property);
							}}
							className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-brandRed hover:bg-[#a0002e] text-white text-xs font-black shadow-[0_10px_20px_rgba(186,0,54,0.2)] hover:shadow-[0_15px_30px_rgba(186,0,54,0.3)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-1.5">
							<MessageCircle size={13} />
							{t.inquireBtn || "Inquire"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

// ─── FILTER SECTION ──────────────────────────────────────────────────────────
const FilterSection = ({ title, children }) => (
	<div className="border-b border-gray-100 last:border-0 pb-6 mb-6">
		<h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-4">{title}</h3>
		{children}
	</div>
);

// ─── MAP VIEW (Google Maps) ──────────────────────────────────────────────────
// Renders an interactive Google Map with custom price-chip markers. A marker
// click bubbles up via `onMarkerClick(property)` so the parent can pop the
// MapMiniCard. Hover/highlight stay in sync with the listing rail on the left.
//
// BACKEND: this component is purely presentational — the `properties` array
// comes from the parent (currently `propertiesData`, swap with a service call).
const MapView = ({ properties, highlightedId, onMarkerHover, onMarkerHoverEnd, onMarkerClick, searchArea, defaultCenter = DEFAULT_MAP_CENTER, defaultZoom = DEFAULT_MAP_ZOOM }) => {
	const [hoveredId, setHoveredId] = useState(null);
	const [mapInstance, setMapInstance] = useState(null);

	// Memoised options so GoogleMap doesn't re-init on every parent re-render.
	const mapOptions = useMemo(
		() => ({
			disableDefaultUI: false,
			mapTypeControl: false,
			streetViewControl: false,
			fullscreenControl: false,
			clickableIcons: false,
			gestureHandling: "greedy",
			styles: MAP_STYLES,
		}),
		[]
	);

	// Load the Maps JS SDK once per page (the loader de-duplicates internally).
	const { isLoaded, loadError } = useJsApiLoader({
		id: "tlp-google-map-script",
		googleMapsApiKey: GOOGLE_MAPS_API_KEY,
		libraries: GOOGLE_MAPS_LIBRARIES,
	});

	// TODO (backend): when the user pans/zooms the map, refetch properties
	// inside the new viewport bounds:
	//
	//   <GoogleMap onIdle={() => {
	//     const b = mapInstance.getBounds();
	//     if (!b) return;
	//     const ne = b.getNorthEast(), sw = b.getSouthWest();
	//     api.get('/api/properties', { params: {
	//       neLat: ne.lat(), neLng: ne.lng(), swLat: sw.lat(), swLng: sw.lng()
	//     }}).then(r => setProperties(r.data));
	//   }} ... />
	//
	// Hook is intentionally left commented so the demo data still works as-is.

	// When the search area or property set changes, fit the map to the matches.
	useEffect(() => {
		if (!mapInstance || !window.google) return;
		const points = (searchArea
			? properties.filter((p) => p.location?.toLowerCase().includes(searchArea.toLowerCase()))
			: properties
		).filter((p) => p.lat && p.lng);
		if (points.length === 0) return;
		if (points.length === 1) {
			mapInstance.panTo({ lat: points[0].lat, lng: points[0].lng });
			mapInstance.setZoom(14);
			return;
		}
		const bounds = new window.google.maps.LatLngBounds();
		points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
		mapInstance.fitBounds(bounds, 64);
	}, [searchArea, properties, mapInstance]);

	const onLoad = useCallback((map) => setMapInstance(map), []);
	const onUnmount = useCallback(() => setMapInstance(null), []);

	// ── Fallback: no API key → public iframe embed (no key required) ──────────
	// Lets the page keep rendering before the key is provisioned.
	if (!GOOGLE_MAPS_API_KEY) {
		return (
			<div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-gray-100">
				<iframe
					title="Properties map"
					src={`https://www.google.com/maps?q=${defaultCenter.lat},${defaultCenter.lng}&hl=en&z=${defaultZoom}&output=embed`}
					width="100%"
					height="100%"
					loading="lazy"
					referrerPolicy="no-referrer-when-downgrade"
					style={{ border: "none", minHeight: 400 }}
					allowFullScreen
				/>
				<div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-600 shadow-sm border border-gray-100">
					Add VITE_GOOGLE_MAPS_API_KEY to enable interactive markers
				</div>
			</div>
		);
	}

	if (loadError) {
		return (
			<div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-gray-50 flex items-center justify-center" style={{ minHeight: 400 }}>
				<div className="text-center px-6">
					<div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-3">
						<MapPin size={20} className="text-brandRed" />
					</div>
					<p className="text-sm font-black text-gray-900 mb-1">Couldn't load Google Maps</p>
					<p className="text-xs font-bold text-gray-500">Check the API key, billing status, and HTTP referrer restrictions.</p>
				</div>
			</div>
		);
	}

	if (!isLoaded) {
		return (
			<div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-gray-50 flex items-center justify-center" style={{ minHeight: 400 }}>
				<div className="flex flex-col items-center gap-3">
					<div className="w-10 h-10 border-4 border-brandRed border-t-transparent rounded-full animate-spin" />
					<span className="text-sm font-bold text-gray-400">Loading map…</span>
				</div>
			</div>
		);
	}

	return (
		<div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-gray-100">
			<GoogleMap
				mapContainerStyle={{ width: "100%", height: "100%", minHeight: 400 }}
				center={defaultCenter}
				zoom={defaultZoom}
				options={mapOptions}
				onLoad={onLoad}
				onUnmount={onUnmount}
			>
				{properties.map((prop) => {
					if (!prop.lat || !prop.lng) return null;
					const isActive = highlightedId === prop.id || hoveredId === prop.id;
					return (
						<OverlayViewF
							key={prop.id}
							position={{ lat: prop.lat, lng: prop.lng }}
							mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
							getPixelPositionOffset={(width, height) => ({ x: -width / 2, y: -height + 6 })}
						>
							{/* OYO-style price pill: dark by default, brand red when active, with a
							    downward pointer that anchors the chip on the marker coordinate. */}
							<button
								type="button"
								onMouseEnter={() => {
									setHoveredId(prop.id);
									onMarkerHover && onMarkerHover(prop.id);
								}}
								onMouseLeave={() => {
									setHoveredId(null);
									onMarkerHoverEnd && onMarkerHoverEnd();
								}}
								onClick={() => onMarkerClick && onMarkerClick(prop)}
								aria-label={`${prop.title} — ৳${prop.price.toLocaleString("en-IN")}`}
								className="map-price-marker relative"
								style={{
									background: isActive ? "#BA0036" : "#111827",
									color: "#ffffff",
									fontSize: 11,
									fontWeight: 900,
									padding: "6px 11px",
									borderRadius: 9999,
									whiteSpace: "nowrap",
									boxShadow: isActive
										? "0 6px 22px rgba(186,0,54,0.45)"
										: "0 6px 18px rgba(17,24,39,0.32)",
									cursor: "pointer",
									border: "2px solid #ffffff",
									transition: "transform 0.18s ease, background 0.18s ease",
									transform: isActive ? "scale(1.12)" : "scale(1)",
									transformOrigin: "center bottom",
									zIndex: isActive ? 9999 : 1,
									outline: "none",
								}}
							>
								৳{(prop.price / 1000).toFixed(0)}k
								{/* Downward pointer (chat-bubble style, matches OYO markers) */}
								<span
									aria-hidden
									style={{
										position: "absolute",
										left: "50%",
										bottom: -5,
										transform: "translateX(-50%)",
										width: 0,
										height: 0,
										borderLeft: "6px solid transparent",
										borderRight: "6px solid transparent",
										borderTop: `7px solid ${isActive ? "#BA0036" : "#111827"}`,
										filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.18))",
									}}
								/>
							</button>
						</OverlayViewF>
					);
				})}
			</GoogleMap>
		</div>
	);
};

// ─── MAP MINI CARD (bottom card on map marker click) ──────────────────────────
// Matches the OYO map reference: a slim horizontal card with the property
// photo on the left and a compact title/price/rating block on the right.
// Used by both mobile and desktop map views — the bottom dock with Filter/List
// renders below it.
//   • Tap the card body  → navigate to the full property page.
//   • Tap "Inquire"      → open the global inquiry modal.
//   • Tap the × button   → close the preview, keep the map state.
const MapMiniCard = ({ property, navigate, onClose, onInquire, t }) => {
	if (!property) return null;
	return (
		<AnimatePresence>
			<motion.div
				key={property.id}
				initial={{ opacity: 0, y: 40 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 40 }}
				transition={{ type: "spring", damping: 28, stiffness: 240 }}
				className="
					relative bg-white shadow-[0_18px_40px_rgba(0,0,0,0.18)] rounded-2xl
					overflow-hidden border border-gray-100 max-w-[560px] mx-auto
				"
				role="dialog"
				aria-label={`${property.title} preview`}
			>
				<div
					onClick={() => navigate(`/property/${property.id}`)}
					className="flex cursor-pointer"
				>
					{/* Photo */}
					<div className="relative w-[130px] sm:w-[150px] h-[130px] sm:h-[140px] shrink-0 bg-gray-100">
						<img
							src={property.images[0]}
							alt={property.title}
							className="absolute inset-0 w-full h-full object-cover"
						/>
						<div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-black">
							<Star size={10} className="fill-yellow-400 text-yellow-400" />
							{property.rating}
							<span className="text-gray-400 font-bold">({property.reviews})</span>
						</div>
					</div>

					{/* Info */}
					<div className="flex-1 min-w-0 p-3 sm:p-4 pr-9 flex flex-col">
						{(() => {
							const cat = RENTAL_CATEGORIES.find((c) => c.id === property.rentalCategory);
							const label = (cat?.tKey && t[cat.tKey]) || cat?.label || "Property";
							return (
								<p className="text-[10px] font-black text-brandRed uppercase tracking-widest mb-1 line-clamp-1">{label}</p>
							);
						})()}
						<p className="text-sm sm:text-[15px] font-black text-gray-900 leading-tight line-clamp-2 mb-1">
							{property.title}
						</p>
						<p className="text-[11px] text-gray-500 font-bold flex items-center gap-1 line-clamp-1 mb-2">
							<MapPin size={10} className="shrink-0" />
							<span className="truncate">{property.location}</span>
						</p>
						<div className="mt-auto flex items-baseline gap-2 flex-wrap">
							<span className="text-base sm:text-lg font-black text-gray-900">
								৳{property.price.toLocaleString("en-IN")}
							</span>
							<span className="text-[10px] text-gray-500 font-bold">/{t?.monthText || "month"}</span>
						</div>
						<div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-gray-500">
							<span className="flex items-center gap-1"><BedDouble size={11} /> {property.beds}</span>
							<span className="flex items-center gap-1"><Bath size={11} /> {property.baths}</span>
							<span className="flex items-center gap-1"><Square size={11} /> {property.sqft}</span>
						</div>
					</div>
				</div>

				{/* Inquire CTA — anchored bottom-right inside the card */}
				<button
					onClick={(e) => {
						e.stopPropagation();
						onClose();
						onInquire(property);
					}}
					className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-brandRed text-white text-[11px] font-black active:scale-95 transition-transform flex items-center gap-1 shadow-md"
				>
					<MessageCircle size={11} /> {t?.inquireBtn || "INQUIRE"}
				</button>

				{/* Close */}
				<button
					onClick={onClose}
					aria-label="Close preview"
					className="absolute top-2 right-2 z-10 p-1.5 bg-white/95 backdrop-blur rounded-full hover:bg-gray-100 active:scale-95 transition-all shadow-sm border border-gray-100"
				>
					<X size={13} className="text-gray-600" />
				</button>
			</motion.div>
		</AnimatePresence>
	);
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const PropertyListing = () => {
	const navigate = useNavigate();
	const { t } = useLanguage();
	const [searchParams, setSearchParams] = useSearchParams();
	const { scrollY } = useScroll();

    // ── NEW LOGIC TO PARSE THE URL SAFELY ──
	const { divisionName } = useParams();
	const routeParam = divisionName ? divisionName.toLowerCase() : "all";

	// Determine if the URL parameter is a known division, or a custom area search (like 'dhanmondi-dhaka')
	const isKnownDivision = validDivisions.includes(routeParam);
	const activeDivision = isKnownDivision ? routeParam : "all";
    // Extract the exact area automatically from the custom URL params!
	const initialSearchAreaFromURL = (!isKnownDivision && routeParam !== "all") ? routeParam.split('-')[0] : "";

	const formattedDivision = (t.cities && t.cities[activeDivision]) || (t.districtNames && t.districtNames[activeDivision]) || (activeDivision === 'all' ? (t.allCities || "All") : activeDivision.charAt(0).toUpperCase() + activeDivision.slice(1));


	// ── INQUIRY MODAL STATE ─────────────────────────────────────────────────────
	// inquiryTarget: the property object the user wants to inquire about (null = modal closed)
	const [inquiryTarget, setInquiryTarget] = useState(null);

	const openInquiry = (property) => setInquiryTarget(property);
	const closeInquiry = () => setInquiryTarget(null);

	// ── UI STATES ───────────────────────────────────────────────────────────────
	const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
	const [toastMessage, setToastMessage] = useState(null);
	const [isStickyFilter, setIsStickyFilter] = useState(false);
	const [isLocating, setIsLocating] = useState(false);
	const [viewMode, setViewMode] = useState("list");
	const [highlightedId, setHighlightedId] = useState(null);
	const [selectedMapProperty, setSelectedMapProperty] = useState(null);

	// ── FILTER STATES ───────────────────────────────────────────────────────────
	const [searchArea, setSearchArea] = useState(initialSearchAreaFromURL);
	const [minPrice, setMinPrice] = useState(5000);
	const [maxPrice, setMaxPrice] = useState(300000);
	const [selectedTypes, setSelectedTypes] = useState([]);
	const [selectedCategories, setSelectedCategories] = useState([]);
	const [selectedBeds, setSelectedBeds] = useState("any");
	const [selectedBathType, setSelectedBathType] = useState([]);
	const [maxSqft, setMaxSqft] = useState(4000);
	const [selectedUtilities, setSelectedUtilities] = useState([]);
	const [selectedTenants, setSelectedTenants] = useState([]);
	const [selectedFurnish, setSelectedFurnish] = useState("");
	const [selectedAmenities, setSelectedAmenities] = useState([]);
	const [selectedFloor, setSelectedFloor] = useState(t.anyFloor || "Any Floor");
	const [minRating, setMinRating] = useState(0);
	const [sortBy, setSortBy] = useState("Newest Listings");

	useMotionValueEvent(scrollY, "change", (latest) => {
		setIsStickyFilter(latest > 120);
	});

	useEffect(() => {
		window.scrollTo(0, 0);

		// ── Budget ────────────────────────────────────────────────────────────────
		const initialBudget = searchParams.get("budget");
		if (initialBudget === "low") { setMinPrice(5000);   setMaxPrice(20000); }
		else if (initialBudget === "mid")     { setMinPrice(20000);  setMaxPrice(50000); }
		else if (initialBudget === "high")    { setMinPrice(50000);  setMaxPrice(100000); }
		else if (initialBudget === "premium") { setMinPrice(100000); setMaxPrice(300000); }
		else if (initialBudget && initialBudget.includes("-")) {
			const [mn, mx] = initialBudget.split("-").map(Number);
			if (!isNaN(mn) && !isNaN(mx)) { setMinPrice(mn); setMaxPrice(mx); }
		}

		// ── Property Type (prop.type: apartment / studio / duplex …) ─────────────
		// Comes from the sidebar "Property Type" checkboxes.
		const initialType = searchParams.get("type");
		if (initialType && initialType !== "any") setSelectedTypes([initialType]);

		// ── Rental Category (prop.rentalCategory: family / bachelor_male …) ──────
		// ⚠️  This is the FIX: Hero & Navbar both send ?category=… (NOT ?type=…)
		//     Routing 'category' to selectedCategories makes Family/Bachelor filters work.
		const initialCategory = searchParams.get("category");
		if (initialCategory && initialCategory !== "any" && initialCategory !== "any_commercial" && initialCategory !== "any_buy") {
			setSelectedCategories([initialCategory]);
		}

		// ── Location fallback from explicit ?location= param ─────────────────────
		const urlLocation = searchParams.get("location");
		if (urlLocation && !searchArea) {
			setSearchArea(urlLocation.split(",")[0]);
		}
	}, [searchParams]);

	const handleNearestMe = () => {
		setIsLocating(true);
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				() => {
					setIsLocating(false);
					setSearchArea(t.nearMe || "Nearby Location");
					showToast("Live location applied!");
				},
				() => {
					setIsLocating(false);
					showToast("Please enable location permissions.");
				}
			);
		} else {
			setIsLocating(false);
			showToast("Geolocation not supported.");
		}
	};

	const showToast = (msg) => {
		setToastMessage(msg);
		setTimeout(() => setToastMessage(null), 3000);
	};

	const handleClearAll = () => {
		setSearchArea("");
		setMinPrice(5000);
		setMaxPrice(300000);
		setSelectedTypes([]);
		setSelectedCategories([]);
		setSelectedBeds("any");
		setSelectedBathType([]);
		setMaxSqft(4000);
		setSelectedUtilities([]);
		setSelectedTenants([]);
		setSelectedFurnish("");
		setSelectedAmenities([]);
		setSelectedFloor(t.anyFloor || "Any Floor");
		setMinRating(0);
		setSortBy("Newest Listings");
		setSearchParams({});
		window.scrollTo({ top: 0, behavior: "smooth" });
        // Force redirect to /properties/all so the 'dhanmondi-dhaka' path is also wiped
		navigate("/properties/all");
	};

	const toggleSection = (section) => setOpenSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]));
	const handleTypeToggle = (typeId) => setSelectedTypes((prev) => (prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]));
	const toggleArrayState = (setter, item) => setter((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

	const handleSave = (e, property) => {
		e.preventDefault();
		e.stopPropagation();
		let savedProps = JSON.parse(localStorage.getItem("savedProperties") || "[]");
		const isCurrentlySaved = savedProps.some((p) => p.id === property.id);
		if (isCurrentlySaved) {
			savedProps = savedProps.filter((p) => p.id !== property.id);
			showToast("Removed from Saved");
		} else {
			savedProps.push({ id: property.id, title: property.title, location: property.location, price: property.price.toString(), beds: property.beds, baths: property.baths, img: property.images[0] });
			showToast("Property Saved Successfully!");
		}
		localStorage.setItem("savedProperties", JSON.stringify(savedProps));
	};

    // ── THE FILTER LOGIC ──────────────────────────────────────────────────────
	// When you're ready to move to the back-end, replace this block with a call
	// to propertyService.getProperties(filters, sortBy) and store the result in
	// state via useEffect + useState. The filter parameters below map 1:1 to the
	// service's applyFilters() helper in src/services/propertyService.js.
	let filteredProperties = propertiesData.filter((prop) => {
		// 1. Division filter (from URL path segment /properties/dhaka)
		if (activeDivision !== "all" && prop.division !== activeDivision) return false;

		// 2. Area text search (e.g. "Dhanmondi" matches location string)
		if (searchArea && searchArea !== (t.nearMe || "Nearby Location") &&
		    !prop.location.toLowerCase().includes(searchArea.toLowerCase())) return false;

		// 3. Price range
		if (prop.price < minPrice || prop.price > maxPrice) return false;

		// 4. Property TYPE (apartment / studio / duplex …) — sidebar checkboxes
		if (selectedTypes.length > 0 && !selectedTypes.includes(prop.type)) return false;

		// 5. Rental CATEGORY (family / bachelor_male / bachelor_female / sublet / student)
		//    ── THIS was the bug: was checking prop.type instead of prop.rentalCategory ──
		if (selectedCategories.length > 0 && !selectedCategories.includes(prop.rentalCategory)) return false;

		// 6. Bedrooms
		if (selectedBeds !== "any") {
			if (selectedBeds === "4+" && prop.beds < 4) return false;
			if (selectedBeds !== "4+" && prop.beds !== Number(selectedBeds)) return false;
		}

		// 7. Max area
		if (prop.sqft > maxSqft) return false;

		// 8. Furnishing
		if (selectedFurnish && prop.furnishing !== selectedFurnish) return false;

		// 9. Minimum rating
		if (minRating > 0 && prop.rating < minRating) return false;

		return true;
	});

	filteredProperties.sort((a, b) => {
		if (sortBy === "Price: Low to High") return a.price - b.price;
		if (sortBy === "Price: High to Low") return b.price - a.price;
		if (sortBy === "Popular") return b.popularity - a.popularity;
		return new Date(b.date) - new Date(a.date);
	});

	const isMapMode = viewMode === "map";

	// Look up landlord for the currently targeted property
	const inquiryLandlord = inquiryTarget ? landlordsData[inquiryTarget.landlordId] || landlordsData[1] : null;

	return (
		<div className="w-full bg-[#f8f9fa] min-h-screen font-sans pb-20 relative">
			{/* TOAST */}
			<AnimatePresence>
				{toastMessage && (
					<motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 text-sm font-bold whitespace-nowrap border border-gray-700">
						<CheckCircle2 size={20} className="text-[#1ab64f]" /> {toastMessage}
					</motion.div>
				)}
			</AnimatePresence>

			{/* STICKY TOP BAR (desktop) */}
			<motion.div initial={{ y: -100 }} animate={{ y: isStickyFilter ? 0 : -100 }} transition={{ duration: 0.3 }} className="fixed top-0 inset-x-0 z-40 bg-white border-b-2 border-gray-900 hidden lg:block">
				<div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="border-2 border-gray-900 text-gray-900 text-xs font-black px-4 py-1.5 rounded-lg flex items-center gap-1 uppercase tracking-wide shadow-[2px_2px_0_0_#ba0036]">
                            {searchArea ? searchArea.charAt(0).toUpperCase() + searchArea.slice(1) : formattedDivision}
                        </span>
						<span className="text-gray-500 font-bold text-sm">
							{t.showing || "Showing"} <strong className="text-gray-900">{filteredProperties.length}</strong> {t.properties || "properties"}
						</span>
					</div>
					<button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-sm font-black text-gray-900 hover:text-[#ba0036] transition-colors flex items-center gap-2 uppercase tracking-wide border-b-2 border-gray-900 hover:border-[#ba0036] pb-0.5">
						<Filter size={14} /> {t.backToTop || "Back to Top"}
					</button>
				</div>
			</motion.div>

			{/* MOBILE TOP BAR */}
			<div className={`bg-white border-b border-gray-100 sticky top-0 md:top-[72px] z-30 shadow-sm transition-opacity duration-300 ${isStickyFilter ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
				<div className="lg:hidden max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
					<span className="text-sm font-bold text-gray-900 truncate">
						{searchArea ? searchArea.charAt(0).toUpperCase() + searchArea.slice(1) : formattedDivision} {t.properties || "Properties"}
					</span>
					<div className="flex items-center gap-2 shrink-0">
						<button onClick={() => setViewMode((v) => (v === "map" ? "list" : "map"))} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-black transition-all active:scale-95 ${isMapMode ? "bg-brandRed text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-brandRed"}`}>
							{isMapMode ? <List size={14} /> : <Map size={14} />}
							{isMapMode ? "List" : "Map"}
						</button>
						<button onClick={() => setIsMobileFilterOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-bold text-gray-700 active:scale-95 transition-transform">
							<Filter size={16} /> {t.filtersBtn || "Filters"}
						</button>
					</div>
				</div>
			</div>

			<div className="max-w-[1400px] mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
				{/* Backdrop. On mobile it shows whenever the filter sheet is open.
				    In map mode it ALSO shows on desktop because the filter renders as a
				    full sheet over the OYO map at every breakpoint. */}
				{isMobileFilterOpen && (
					<div
						className={`fixed inset-0 bg-black/50 transition-opacity ${
							isMapMode ? "z-[75]" : "z-40 lg:hidden"
						}`}
						onClick={() => setIsMobileFilterOpen(false)}
					/>
				)}

				{/* SIDEBAR FILTERS
				    Two render modes:
				      • Default (list view)  → desktop: in-flow sticky sidebar; mobile: bottom-sheet
				      • Map mode             → bottom-sheet on EVERY breakpoint so the Filter
				                                button in the map's bottom dock can open it on top
				                                of the full-screen map. */}
				<aside className={`bg-white max-h-[90vh] overflow-y-auto transition-transform duration-300 transform ${
					isMapMode
						? `fixed inset-x-0 bottom-0 z-[80] rounded-t-[2rem] ${isMobileFilterOpen ? "translate-y-0" : "translate-y-full"}`
						: `fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] lg:sticky lg:top-[90px] lg:z-10 lg:h-[calc(100vh-110px)] lg:block lg:rounded-[2rem] lg:border lg:border-gray-100 lg:shadow-sm lg:p-0 ${isMobileFilterOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"}`
				}`}>
					<div className={`sticky top-0 bg-white z-20 px-6 pt-4 pb-2 border-b border-gray-50 rounded-t-[2rem] ${isMapMode ? "" : "lg:hidden"}`}>
						<div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4"></div>
						<div className="flex justify-between items-center mb-2">
							<h2 className="text-xl font-black text-gray-900">{t.filtersBtn || "Filters"}</h2>
							<div className="flex items-center gap-2">
								<button onClick={handleClearAll} className="text-[11px] font-black text-[#ba0036] uppercase tracking-wider px-2 py-1 rounded-md hover:bg-red-50 transition-colors">
									{t.clearAll || "Clear All"}
								</button>
								<button onClick={() => setIsMobileFilterOpen(false)} aria-label="Close filters" className="p-2 bg-gray-100 rounded-full active:scale-95 transition-transform">
									<X size={18} />
								</button>
							</div>
						</div>
					</div>

					<div className="p-6 lg:p-6 lg:h-full lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
						<div className="hidden lg:flex justify-between items-center mb-8 border-b-2 border-gray-900 pb-4">
							<h2 className="text-xl font-black text-gray-900 uppercase tracking-wider">{t.filtersBtn || "Filters"}</h2>
							<button onClick={handleClearAll} className="text-xs font-black text-[#ba0036] hover:text-gray-900 uppercase tracking-widest transition-colors border-b-2 border-transparent hover:border-gray-900">
								{t.clearAll || "Clear All"}
							</button>
						</div>

						<FilterSection title={t.filterLocation || "Location"}>
							<div className="relative mb-4">
								<input type="text" value={searchArea} onChange={(e) => setSearchArea(e.target.value)} placeholder={t.searchAreaPlaceholder || "Search area..."} className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-10 pr-24 text-xs font-bold focus:border-brandRed outline-none" />
								<Search size={14} className="absolute left-3.5 top-3.5 text-gray-400" />
								<button onClick={handleNearestMe} disabled={isLocating} className="absolute right-2 top-2 bg-white border border-gray-200 shadow-sm text-[9px] font-black uppercase text-brandRed px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-red-50 transition-colors">
									<Navigation size={10} className={isLocating ? "animate-spin" : ""} /> {isLocating ? t.locating || "Locating" : t.nearMe || "Near Me"}
								</button>
							</div>
							<div className="flex flex-wrap gap-2">
								{[t.districtNames?.gulshan || "Gulshan", t.districtNames?.banani || "Banani", t.districtNames?.dhanmondi || "Dhanmondi", t.districtNames?.bashundhara || "Bashundhara"].map((area) => (
									<button key={area} onClick={() => setSearchArea(searchArea === area ? "" : area)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${searchArea === area ? "bg-brandRed text-white border-brandRed shadow-md" : "bg-gray-50 text-gray-600 border-transparent hover:border-brandRed hover:text-brandRed"}`}>
										{area}
									</button>
								))}
							</div>
						</FilterSection>

						<FilterSection title={t.filterPrice || "Price Range"}>
							<div className="px-2 pb-4">
								{/* Quick budget pills — one tap sets the min/max range. */}
								<div className="mb-5">
									<p className="text-[10px] font-black text-gray-400 mb-2 uppercase tracking-wider">{t.quickBudgetLabel || "Quick budget"}</p>
									<div className="flex flex-wrap gap-1.5">
										{[
											{ id: "u15", min: 5000,  max: 15000,  tKey: "budgetUpto15k",  fallback: "Under ৳15k" },
											{ id: "u25", min: 15000, max: 25000,  tKey: "budgetUpto25k",  fallback: "৳15k–৳25k" },
											{ id: "u40", min: 25000, max: 40000,  tKey: "budgetUpto40k",  fallback: "৳25k–৳40k" },
											{ id: "u60", min: 40000, max: 60000,  tKey: "budgetUpto60k",  fallback: "৳40k–৳60k" },
											{ id: "a60", min: 60000, max: 300000, tKey: "budgetAbove60k", fallback: "Above ৳60k" },
										].map((b) => {
											const active = minPrice === b.min && maxPrice === b.max;
											return (
												<button
													key={b.id}
													type="button"
													onClick={() => { setMinPrice(b.min); setMaxPrice(b.max); }}
													className={`px-2.5 py-1.5 rounded-full text-[11px] font-black border-2 transition-all ${
														active
															? "bg-gray-900 text-white border-gray-900"
															: "bg-white text-gray-700 border-gray-200 hover:border-gray-900"
													}`}
												>
													{t[b.tKey] || b.fallback}
												</button>
											);
										})}
									</div>
								</div>
								<div className="relative h-2 bg-gray-200 rounded-full mb-10 mt-6 mx-2">
									<div className="absolute h-full bg-brandRed rounded-full z-10" style={{ left: `${((minPrice - 5000) / 295000) * 100}%`, right: `${((300000 - maxPrice) / 295000) * 100}%` }}></div>
									<input type="range" min="5000" max="300000" step="1000" value={minPrice} onChange={(e) => setMinPrice(Math.min(Number(e.target.value), maxPrice - 5000))} className="absolute w-full -top-3 h-8 appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-brandRed [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg cursor-pointer" />
									<input type="range" min="5000" max="300000" step="1000" value={maxPrice} onChange={(e) => setMaxPrice(Math.max(Number(e.target.value), minPrice + 5000))} className="absolute w-full -top-3 h-8 appearance-none bg-transparent pointer-events-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-brandRed [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg cursor-pointer" />
								</div>
								<div className="flex gap-4">
									<div className="flex-1">
										<label className="text-[9px] font-black text-gray-400 uppercase">{t.minPrice || "Min Price"}</label>
										<input type="number" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-brandRed text-gray-700" />
									</div>
									<div className="flex-1">
										<label className="text-[9px] font-black text-gray-400 uppercase">{t.maxPrice || "Max Price"}</label>
										<input type="number" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-brandRed text-gray-700" />
									</div>
								</div>
							</div>
						</FilterSection>

						<FilterSection title={t.filterPropType || "Property Type"}>
							<div className="grid grid-cols-1 gap-2">
								{[
									{ id: "apartment",   label: t.propApartment   || "Apartment" },
									{ id: "independent", label: t.propIndependent || "Independent House" },
									{ id: "duplex",      label: t.propDuplex      || "Duplex" },
									{ id: "studio",      label: t.propStudio      || "Studio" },
									{ id: "penthouse",   label: t.propPenthouse   || "Penthouse" },
								].map((type) => (
									<label key={type.id} className={`flex items-center gap-3 cursor-pointer px-3 py-2 rounded-lg border-2 text-xs font-bold transition-all ${selectedTypes.includes(type.id) ? 'border-gray-900 bg-gray-50' : 'border-transparent hover:border-gray-300'}`}>
										<input type="checkbox" checked={selectedTypes.includes(type.id)} onChange={() => handleTypeToggle(type.id)} className="w-4 h-4 rounded accent-gray-900" /> {type.label}
									</label>
								))}
							</div>
						</FilterSection>

						<FilterSection title={t.filterWhoMovesIn || "Who's moving in?"}>
							{/* 2-column chip grid. Each chip toggles a category id —
							    multi-select supported so e.g. "Family + Sublet" works. */}
							<div className="grid grid-cols-2 gap-2">
								{RENTAL_CATEGORIES.map((cat) => {
									const Icon = cat.icon;
									const active = selectedCategories.includes(cat.id);
									const label = (cat.tKey && t[cat.tKey]) || cat.label;
									return (
										<button
											key={cat.id}
											type="button"
											onClick={() => toggleArrayState(setSelectedCategories, cat.id)}
											className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 text-[11px] font-black leading-tight text-center transition-all ${
												active
													? "bg-gray-900 text-white border-gray-900 shadow-[2px_2px_0_0_#ba0036]"
													: "bg-white text-gray-700 border-gray-200 hover:border-gray-900 hover:text-gray-900"
											}`}
										>
											<Icon size={18} className={active ? "text-white" : "text-brandRed"} />
											<span>{label}</span>
										</button>
									);
								})}
							</div>
						</FilterSection>

						<FilterSection title={t.filterRooms || "Bedrooms & Bathrooms"}>
							<p className="text-[10px] font-black text-gray-400 mb-2 uppercase">{t.bedrooms || "Bedrooms"}</p>
							<div className="flex gap-2 mb-5">
								{[
									{ id: "any", text: t.any || "Any" },
									{ id: "1", text: "1" },
									{ id: "2", text: "2" },
									{ id: "3", text: "3" },
									{ id: "4+", text: "4+" },
								].map((num) => (
									<button key={num.id} onClick={() => setSelectedBeds(num.id)} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${selectedBeds === num.id ? "bg-brandRed text-white border-brandRed" : "border-gray-100 text-gray-500 hover:border-brandRed"}`}>
										{num.text}
									</button>
								))}
							</div>
							<p className="text-[10px] font-black text-gray-400 mb-2 uppercase">{t.bathroomType || "Bathroom Type"}</p>
							<div className="grid grid-cols-2 gap-3">
								{[t.attachedBath || "Attached", t.sharedBath || "Shared"].map((b) => (
									<label key={b} className="flex items-center gap-2 text-xs font-bold text-gray-600">
										<input type="checkbox" checked={selectedBathType.includes(b)} onChange={() => toggleArrayState(setSelectedBathType, b)} className="accent-brandRed w-4 h-4" /> {b}
									</label>
								))}
							</div>
						</FilterSection>

						<FilterSection title={t.filterSize || "Size (Area Sqft)"}>
							<div className="px-2">
								<div className="flex items-center justify-between mb-4 text-xs font-bold text-gray-600">
									<span className="flex items-center gap-2">
										<Ruler size={14} className="text-brandRed" /> {t.maxSize || "Max Size:"}
									</span>
									<span className="text-brandRed">{maxSqft} sqft</span>
								</div>
								<input type="range" min="500" max="4000" step="100" value={maxSqft} onChange={(e) => setMaxSqft(Number(e.target.value))} className="w-full accent-brandRed cursor-pointer" />
							</div>
						</FilterSection>

						<FilterSection title={t.filterUtilities || "Utilities Included"}>
							<div className="grid grid-cols-2 gap-3">
								{[t.waterBill || "Water", t.electricityBill || "Electricity", t.gasSupply || "Gas", t.internetWifi || "WiFi", t.serviceCharge || "Service Charge"].map((u) => (
									<label key={u} className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
										<input type="checkbox" checked={selectedUtilities.includes(u)} onChange={() => toggleArrayState(setSelectedUtilities, u)} className="accent-brandRed w-4 h-4 rounded" /> {u}
									</label>
								))}
							</div>
						</FilterSection>

						<FilterSection title={t.filterTenant || "Tenant & Furnishing"}>
							<p className="text-[10px] font-black text-gray-400 mb-2 uppercase">{t.tenantType || "Tenant Type"}</p>
							<div className="grid grid-cols-2 gap-3 mb-5">
								{[t.family || "Family", t.bachelor || "Bachelor", t.students || "Students", t.petsAllowed || "Pets Allowed"].map((tn) => (
									<label key={tn} className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
										<input type="checkbox" checked={selectedTenants.includes(tn)} onChange={() => toggleArrayState(setSelectedTenants, tn)} className="accent-brandRed w-4 h-4 rounded" /> {tn}
									</label>
								))}
							</div>
							<p className="text-[10px] font-black text-gray-400 mb-2 uppercase">{t.furnishing || "Furnishing"}</p>
							<div className="grid grid-cols-1 gap-2">
								{[
									{ id: "", label: t.any || "Any" },
									{ id: "Furnished", label: t.furnished || "Furnished" },
									{ id: "Semi-Furnished", label: t.semiFurnished || "Semi-Furnished" },
									{ id: "Unfurnished", label: t.unfurnished || "Unfurnished" },
								].map((f) => (
									<label key={f.id} className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
										<input type="radio" name="furnish" checked={selectedFurnish === f.id} onChange={() => setSelectedFurnish(f.id)} className="accent-brandRed w-4 h-4" /> {f.label}
									</label>
								))}
							</div>
						</FilterSection>

						<FilterSection title={t.filterAmenities || "Amenities & Floor"}>
							<p className="text-[10px] font-black text-gray-400 mb-2 uppercase">{t.amenities || "Amenities"}</p>
							<div className="grid grid-cols-2 gap-3 mb-5">
								{[t.parking || "Parking", t.elevator || "Elevator", t.securityCctv || "CCTV", t.generator || "Generator", t.ac || "AC"].map((a) => (
									<label key={a} className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
										<input type="checkbox" checked={selectedAmenities.includes(a)} onChange={() => toggleArrayState(setSelectedAmenities, a)} className="accent-brandRed w-4 h-4 rounded" /> {a}
									</label>
								))}
							</div>
							<p className="text-[10px] font-black text-gray-400 mb-2 uppercase">{t.floorLevel || "Floor Level"}</p>
							<select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-brandRed">
								<option>{t.anyFloor || "Any Floor"}</option>
								<option>{t.groundFloor || "Ground Floor"}</option>
								<option>{t.floor1to3 || "1st to 3rd Floor"}</option>
							</select>
						</FilterSection>

						<FilterSection title={t.filterRating || "Property Rating"}>
							<div className="flex flex-col gap-3">
								{[
									{ val: 4, label: t.star4Above || "4.0 & Above" },
									{ val: 3, label: t.star3Above || "3.0 & Above" },
									{ val: 0, label: t.anyRating || "Any Rating" },
								].map((r) => (
									<label key={r.val} className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
										<input type="radio" name="rating" checked={minRating === r.val} onChange={() => setMinRating(r.val)} className="accent-brandRed w-4 h-4" />
										<Star size={14} className={r.val > 0 ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} /> {r.label}
									</label>
								))}
							</div>
						</FilterSection>

						<div className="pt-4 mt-6 lg:hidden">
							<button
								onClick={() => {
									setIsMobileFilterOpen(false);
									window.scrollTo({ top: 0, behavior: "smooth" });
								}}
								className="w-full bg-gray-900 text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-transform">
								{t.applyFiltersBtn || "Apply Filters"}
							</button>
						</div>
					</div>
				</aside>

				{/* MAIN RIGHT CONTENT */}
				<main className="flex flex-col gap-6 lg:gap-8 min-h-screen">
					<div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
						<div>
							<p className="text-xs font-bold text-gray-500 flex items-center gap-2 mb-2">
								<Link to="/" className="hover:text-brandRed transition-colors">
									{t.home || "Home"}
								</Link>{" "}
								<ChevronRight size={12} />
								<Link to="/properties/all" className="hover:text-brandRed transition-colors">
									{t.bangladesh || "Bangladesh"}
								</Link>{" "}
								<ChevronRight size={12} />
								<span className={searchArea ? "hover:text-brandRed cursor-pointer transition-colors" : "text-gray-900"} onClick={() => setSearchArea("")}>
									{formattedDivision}
								</span>
								{searchArea && searchArea !== (t.nearMe || "Nearby Location") && (
									<>
										<ChevronRight size={12} />
										<span className="text-brandRed">{searchArea.charAt(0).toUpperCase() + searchArea.slice(1)}</span>
									</>
								)}
							</p>
							<h1 className="text-3xl font-black text-gray-900 tracking-tight">
								{searchArea && searchArea !== (t.nearMe || "Nearby Location") ? searchArea.charAt(0).toUpperCase() + searchArea.slice(1) : formattedDivision} {t.properties || "Properties"}
							</h1>
						</div>
						<div className="flex items-center gap-3">
							<div className="hidden md:flex items-center bg-gray-100 rounded-xl p-1 gap-1">
								<button onClick={() => setViewMode("list")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${!isMapMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
									<List size={14} /> List
								</button>
								<button onClick={() => setViewMode("map")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${isMapMode ? "bg-brandRed text-white shadow-sm" : "text-gray-500 hover:text-brandRed"}`}>
									<Map size={14} /> Map View
								</button>
							</div>
							<div className="hidden md:flex items-center gap-2">
								<span className="text-sm font-bold text-gray-500">{t.sortBy || "Sort by:"}</span>
								<select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-brandRed cursor-pointer shadow-sm hover:shadow-md transition-shadow">
									<option value="Newest Listings">{t.sortNewest || "Newest Listings"}</option>
									<option value="Price: Low to High">{t.sortPriceLowHigh || "Price: Low to High"}</option>
									<option value="Price: High to Low">{t.sortPriceHighLow || "Price: High to Low"}</option>
									<option value="Popular">{t.sortPopular || "Popular"}</option>
								</select>
							</div>
						</div>
					</div>

					<AnimatePresence mode="wait">
						{isMapMode ? null : (
							<motion.div key="list-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="w-full">
								{filteredProperties.length > 0 ? (
									filteredProperties.map((property) => {
										return (
											<React.Fragment key={property.id}>
												{/* DESKTOP: full PropertyCard */}
												<div className="hidden md:block mb-6">
													<PropertyCard property={property} navigate={navigate} t={t} showToast={showToast} isHighlighted={highlightedId === property.id} onHover={setHighlightedId} onHoverEnd={() => setHighlightedId(null)} onInquire={openInquiry} />
												</div>
											</React.Fragment>
										);
									})
								) : (
									<div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 flex flex-col items-center justify-center shadow-sm">
										<div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
											<Search className="text-brandRed" size={24} />
										</div>
										<h3 className="text-xl font-black text-gray-900 mb-2">{t.noPropsFound || "No Properties Found"}</h3>
										<p className="text-sm font-bold text-gray-500 mb-6">{t.noPropsDesc || "Try adjusting your filters or search criteria."}</p>
										<button onClick={handleClearAll} className="bg-gray-900 text-white px-8 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-md hover:shadow-lg">
											{t.clearFilters || "Clear Filters"}
										</button>
									</div>
								)}

								{/* MOBILE: single-column horizontal cards (image left, info right).
								    Easier to read than the previous cramped 2-col grid and matches
								    the OYO/airbnb list-view pattern. */}
								{filteredProperties.length > 0 && (
									<div className="flex flex-col gap-3 pb-10 md:hidden">
										{filteredProperties.map((property) => {
											const catLabel = RENTAL_CATEGORIES.find((c) => c.id === property.rentalCategory);
											const catText = (catLabel?.tKey && t[catLabel.tKey]) || catLabel?.label || "Property";
											const discountPercent = Math.round(((property.originalPrice - property.price) / property.originalPrice) * 100);
											return (
												<div
													key={property.id}
													onClick={() => navigate(`/property/${property.id}`)}
													className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm active:scale-[0.99] transition-transform cursor-pointer"
												>
													<div className="flex">
														{/* Photo */}
														<div className="relative w-[130px] h-[130px] shrink-0 bg-gray-100">
															<img
																src={property.images[0]}
																alt={property.title}
																className="absolute inset-0 w-full h-full object-cover"
															/>
															{property.verified && (
																<div className="absolute top-1.5 left-1.5 bg-white/95 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[8px] font-black text-brandRed flex items-center gap-0.5">
																	<ShieldCheck size={8} /> Verified
																</div>
															)}
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	handleSave(e, property);
																}}
																aria-label="Save"
																className="absolute top-1.5 right-1.5 p-1.5 bg-white/95 backdrop-blur-sm rounded-full hover:bg-white transition-all">
																<Heart size={11} className="text-gray-700" />
															</button>
														</div>

														{/* Info */}
														<div className="flex-1 min-w-0 p-3 flex flex-col">
															<p className="text-[9px] font-black text-brandRed uppercase tracking-widest line-clamp-1">{catText}</p>
															<h4 className="text-[13px] font-black text-gray-900 leading-tight line-clamp-2 mt-0.5">{property.title}</h4>
															<p className="text-[10px] text-gray-500 font-bold flex items-center gap-1 line-clamp-1 mt-1">
																<MapPin size={10} className="shrink-0" /> {property.location}
															</p>
															<div className="mt-auto flex items-baseline gap-1.5 pt-2">
																<span className="text-base font-black text-gray-900">৳{(property.price / 1000).toFixed(0)}k</span>
																<span className="text-[10px] text-gray-500 font-bold">/{t.monthText || "mo"}</span>
																{property.originalPrice > property.price && (
																	<span className="ml-auto bg-green-100 text-green-700 text-[9px] font-black px-1.5 py-0.5 rounded">{discountPercent}% {t.offText || "OFF"}</span>
																)}
															</div>
															<div className="flex items-center gap-2.5 text-[10px] font-bold text-gray-500 mt-1.5 pt-1.5 border-t border-gray-100">
																<span className="flex items-center gap-1"><BedDouble size={10} /> {property.beds}</span>
																<span className="flex items-center gap-1"><Bath size={10} /> {property.baths}</span>
																<span className="flex items-center gap-1"><Square size={10} /> {property.sqft}</span>
																<span className="ml-auto flex items-center gap-1">
																	<Star size={10} className="fill-yellow-400 text-yellow-400" /> {property.rating}
																</span>
															</div>
														</div>
													</div>

													{/* CTAs */}
													<div className="px-3 pb-3 grid grid-cols-2 gap-2 -mt-1">
														<button
															onClick={(e) => {
																e.stopPropagation();
																navigate(`/property/${property.id}`);
															}}
															className="py-2 rounded-lg text-[11px] font-black text-gray-700 bg-gray-50 border border-gray-100 active:scale-95 transition-transform">
															{t.detailsBtn || "Details"}
														</button>
														<button
															onClick={(e) => {
																e.stopPropagation();
																openInquiry(property);
															}}
															className="py-2 rounded-lg bg-brandRed text-white text-[11px] font-black active:scale-95 transition-transform flex items-center justify-center gap-1 shadow-sm">
															<MessageCircle size={11} /> {t.inquireBtn || "Inquire"}
														</button>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</main>
			</div>

			{/* ── OYO-STYLE FULL-SCREEN MAP (shared by mobile + desktop) ─────────────
			    Renders as a fixed overlay above the page when `viewMode === 'map'`.
			    Same component & state on every breakpoint — no mobile/desktop fork. */}
			<AnimatePresence>
				{isMapMode && (
					<motion.div
						key="oyo-map"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18 }}
						className="fixed inset-0 z-[60] bg-white flex flex-col"
						role="dialog"
						aria-label="Map view"
					>
						{/* Floating search bar — back + search + clear (matches OYO). */}
						<div className="absolute top-0 inset-x-0 z-30 px-3 pt-3 pb-2 pointer-events-none">
							<div className="max-w-[640px] mx-auto bg-white rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.18)] flex items-center gap-1 px-2 py-1.5 pointer-events-auto border border-gray-100">
								<button
									onClick={() => setViewMode("list")}
									aria-label="Back to list"
									className="p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition-all">
									<ArrowLeft size={18} className="text-gray-800" />
								</button>
								<input
									type="text"
									value={searchArea}
									onChange={(e) => setSearchArea(e.target.value)}
									placeholder={searchArea ? "" : (t.searchAreaPlaceholder || "Search area...")}
									className="flex-1 outline-none bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-400"
								/>
								{searchArea && (
									<button
										onClick={() => setSearchArea("")}
										aria-label="Clear search"
										className="p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition-all">
										<X size={16} className="text-gray-600" />
									</button>
								)}
							</div>
							{/* Property count pill */}
							<div className="max-w-[640px] mx-auto mt-2 pointer-events-auto flex">
								<span className="bg-white/95 backdrop-blur px-3 py-1.5 rounded-full text-[11px] font-black text-gray-900 shadow-md flex items-center gap-1.5 border border-gray-100">
									<MapPin size={11} className="text-brandRed" />
									{filteredProperties.length} {t.properties || "Properties"}
								</span>
							</div>
						</div>

						{/* Map fills the whole screen */}
						<div className="absolute inset-0">
							<div className="w-full h-full">
								<MapView
									properties={filteredProperties}
									highlightedId={highlightedId}
									onMarkerHover={setHighlightedId}
									onMarkerHoverEnd={() => setHighlightedId(null)}
									onMarkerClick={(prop) => setSelectedMapProperty(prop)}
									searchArea={searchArea}
								/>
							</div>
						</div>

						{/* Bottom card — appears just above the dock when a marker is tapped. */}
						{selectedMapProperty && (
							<div className="absolute inset-x-0 bottom-[64px] z-30 px-3 pb-2 pointer-events-none">
								<div className="pointer-events-auto">
									<MapMiniCard
										property={selectedMapProperty}
										navigate={navigate}
										onClose={() => setSelectedMapProperty(null)}
										onInquire={openInquiry}
										t={t}
									/>
								</div>
							</div>
						)}

						{/* Bottom dock: Filter | Sort | List (matches OYO black bar). */}
						<div className="absolute inset-x-0 bottom-0 z-30 bg-gray-900 text-white shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
							<div className="max-w-[640px] mx-auto flex items-stretch divide-x divide-white/10">
								<button
									onClick={() => setIsMobileFilterOpen(true)}
									className="flex-1 py-4 flex items-center justify-center gap-2 text-sm font-black active:bg-white/10 transition-colors">
									<SlidersHorizontal size={16} /> {t.filtersBtn || "Filter"}
								</button>
								<div className="flex-1 relative">
									<select
										value={sortBy}
										onChange={(e) => setSortBy(e.target.value)}
										aria-label={t.sortBy || "Sort by"}
										className="absolute inset-0 opacity-0 cursor-pointer text-white"
									>
										<option value="Newest Listings">{t.sortNewest || "Newest Listings"}</option>
										<option value="Price: Low to High">{t.sortPriceLowHigh || "Price: Low to High"}</option>
										<option value="Price: High to Low">{t.sortPriceHighLow || "Price: High to Low"}</option>
										<option value="Popular">{t.sortPopular || "Popular"}</option>
									</select>
									<div className="py-4 flex items-center justify-center gap-2 text-sm font-black pointer-events-none">
										<ArrowUpDown size={16} /> {t.sortBy?.replace(":", "") || "Sort"}
									</div>
								</div>
								<button
									onClick={() => setViewMode("list")}
									className="flex-1 py-4 flex items-center justify-center gap-2 text-sm font-black active:bg-white/10 transition-colors">
									<List size={16} /> List
								</button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── INQUIRY MODAL (single instance, shown for whichever property was clicked) ── */}
			<InquiryModal isOpen={!!inquiryTarget} onClose={closeInquiry} property={inquiryTarget} landlord={inquiryLandlord} />
		</div>
	);
};

export default PropertyListing;
