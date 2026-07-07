<div align="center">
  <img src="./src/assets/logo dark mode.png" alt="Arcadia Logo" width="300" height="300">

# 🎬 Arcadia: Personal Media Vault

> Your Ultimate Local Movie & TV Show Library Manager

<br>

![Tauri](https://img.shields.io/badge/Tauri-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-0EA5A0?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)
![TMDB API](https://img.shields.io/badge/TMDB_API-01D277?style=for-the-badge&logo=themoviedatabase&logoColor=white)
![Fedora](https://img.shields.io/badge/Fedora-382629?style=for-the-badge&logo=fedora&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)


</div>

---

## 🖥️ Overview

**Arcadia Personal Media Vault** is a lightweight, high-performance desktop application designed to organize and showcase your personal movie and TV show collection.

By integrating with **The Movie Database (TMDB) API**, Arcadia automatically scans your local folders and enriches them with official posters, ratings, and metadata — giving your home media library a premium, streaming-service look and feel.

### ✨ Key Features

* 📁 **Smart Folder Scanning:** Instantly indexes your local movie subfolders.
* 🏷️ **Automated Metadata:** Fetches official posters, genres, and ratings dynamically from TMDB.
* 🔍 **Instant Search & Filter:** Quick search bar and genre pills to sift through your library in seconds.
* 🔒 **Secure API Gate:** Built-in validation setup preventing crashes and securing your API key.
* 🎨 **Minimalist Premium UI:** Fully responsive dashboard supporting localized assets and themes.
* 🐧 **Native Linux Experience:** Highly optimized native `.rpm` bundle perfectly suited for Fedora/RHEL systems.

---

## 🚀 Download & Installation Guide

Arcadia is pre-compiled for convenience. You do not need to install programming tools to run it.

### 🐧 On Linux (Fedora / RHEL)

Arcadia provides a native, secure `.rpm` package fully optimized for your environment.

1. Go to the **Releases** section on the right side of this GitHub repository.
2. Download the latest `Arcadia-X.X.X.x86_64.rpm` bundle.
3. Open your terminal and run the installation command:

```bash
sudo dnf install /path/to/downloaded/Arcadia-0.1.0-1.x86_64.rpm
```

4. Search for **Arcadia** in your application launcher and launch it!

*(Note: Windows support is currently under active development and will be available in future releases).*

---

## 🔑 Step-by-Step: How to Get Your TMDB API Key

Arcadia requires a free API key from **The Movie Database (TMDB)** to fetch official media posters and information. Follow these simple steps to obtain your key:

| Step | Action | Details |
|---|---|---|
| 1 | Create an Account | Head over to [The Movie Database (TMDB)](https://www.themoviedb.org/) and sign up for a free account. |
| 2 | Verify Email | Check your inbox and click the verification link to activate your account. |
| 3 | Navigate to Settings | Click your profile icon on the top right of the TMDB website, select **Settings**, then choose **API** from the left sidebar. |
| 4 | Create API Key | Click on **Create** under the API section and choose the **Developer** application type. |
| 5 | Fill Details | Accept the terms of use and fill in basic application info (e.g., Application Name: *Arcadia Vault*, Purpose: *Personal media management*). |
| 6 | Copy API Key | Once approved instantly, copy the **API Read Change Access Token (v4 auth)** or the **API Key (v3 auth)** depending on your request. |

> ⚠️ **Security Warning:** Never share your API key publicly. Arcadia saves this key entirely **locally** on your machine's secure local storage, keeping it completely invisible to external users.

---

## 🛠️ First-Time Configuration Workflow

When you launch Arcadia for the very first time, you will be greeted by a **Strict Setup Gate**. This ensures the application operates without errors.

1. **Input Your Key:** The application will prompt you to enter your TMDB API Key. Paste the key you obtained from the section above and click **Save**.
2. **Persistence:** Once saved, Arcadia stores this preference. You will **never** have to enter your key again unless you decide to change it from the settings.
3. **Select Your Library:** Click the prominent **Browse Folders** button, select the root folder where your subfolders of movies are located, and watch your local library populate beautifully!

---

## 💻 Local Development Setup

If you wish to modify the code or build the application from source code manually on your machine, follow these instructions:

### Prerequisites

Ensure your development environment contains the following dependencies:

- Node.js (v18+)
- Rust & Cargo (via `rustup`)
- Linux Packages (For Fedora/RHEL development setups):

```bash
sudo dnf groupinstall "Development Tools"
sudo dnf install webkit2gtk4.0-devel openssl-devel curl wget
```

### Quickstart Installation

1. **Clone the Repository:**

```bash
git clone https://github.com/mshJoe/Arcadia.git
cd Arcadia
```

2. **Install Package Dependencies:**

```bash
npm install
```

3. **Run the Live Development Environment:**

```bash
npm run tauri dev
```

### Building the Production Distribution Packages

To bundle and lock down native release packages manually on your active OS platform architecture:

```bash
npm run tauri build
```

---

## 📁 Project Structure

*   `.github/workflows/` — Contains GitHub Actions CI/CD pipelines for multi-platform releases.
*   `public/` — Static assets and the main entry point.
*   `src/` — Contains all the React components, styles, and core frontend application logic.
    *   `assets/` — Images, logos, and UI asset files.
    *   `api.ts` — Handles all network requests and TMDB API interactions.
    *   `App.tsx` — Main application component containing the core layout, routing, and state logic.
    *   `App.css` — Global CSS styling and overrides.
    *   `main.tsx` — React entry point mapping to the root DOM node.
*   `src-tauri/` — Contains the Rust backend code, Tauri configuration, and native OS build settings.
*   `index.html` — The base HTML template served by Vite.
*   `package.json` — Project dependencies and npm scripts.
*   `tsconfig.json` — TypeScript compiler options and strict typing rules.
*   `vite.config.ts` — Vite bundler and development server configurations.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues) if you want to contribute.

## 📄 License

Copyright &copy; 2026 Youssef Almghraby. All rights reserved.
