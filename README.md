# Spice Veg Agri – QR Seed Label System

This repository hosts the official web application for **Spice Veg Agri**, designed to provide customers with instant access to seed quality metrics and cultivation techniques via QR code scanning.

## 🚀 Live Application
**URL:** [https://krishnakoushik9.github.io/Spice-Veg-Agri-Customer/](https://krishnakoushik9.github.io/Spice-Veg-Agri-Customer/)

---

## 🛠 Features

### 1. Admin Dashboard (Label Management)
- **Secure Access:** Password-protected login for authorized staff.
- **Label Creation:** Generate "Truthful Labels" with batch-specific data (Germination, Purity, Moisture, etc.).
- **Automatic ID:** System automatically assigns the next sequential label number (e.g., `00001`, `00002`).
- **QR Generation:** Instant generation of high-fidelity QR codes for each seed packet.
- **Tools:** Download QR codes as PNG or print labels directly to a 60mm thermal/label printer.
- **Records:** View and edit all previously generated labels stored in Firebase Firestore.

### 2. Customer Verification (QR Scan)
- **Instant Metrics:** Scanned QR codes lead customers to a mobile-optimized page showing real-time quality data.
- **Visual Progress:** Easy-to-read progress bars for Germination and Purity.
- **Cultivation Guide:** Quick access to crop-specific cultivation technique images.
- **Verification Badge:** Visual confirmation that the product is authentic and verified by SpiceVeg Agri.

---

## 🔑 Access Credentials (Admin)
- **Username:** `Srikanth`
- **Password:** *(Internal use only)*

---

## 📁 File Structure
- `index.html`: The entire single-file application (HTML/CSS/JS).
- `technique_[crop].png`: Visual guides for different crops (e.g., `technique_chilli.png`).
- `logo.png`: Company branding.

---

## 🔧 Technical Stack
- **Frontend:** Vanilla JS, CSS3, HTML5 (Single File).
- **Database:** Firebase Firestore (via REST API).
- **QR Engine:** QRCode.js.
- **Hosting:** GitHub Pages.

---

## 📅 Maintenance & Updates
- **Status:** Active / Production Ready
- **Last Updated:** April 2026
- **Developer:** Build Agent via Gemini CLI
