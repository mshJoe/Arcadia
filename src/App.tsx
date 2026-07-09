import { useState, useEffect } from "react";
import { Search, Film, Tv, LayoutGrid, Sun, Moon, Play, FolderUp, X, RefreshCw, Image as ImageIcon, ImageOff, Settings } from "lucide-react";
import { searchMovie, getMediaDetails, searchMediaFull, getMediaImages, getGenreNames } from "./api";

export interface MediaItem {
  id: number | string;
  title: string;
  year: string;
  rating: string | number;
  type: string;
  poster: string | null;
  folderName: string;
  rawGenres: string[];
  tags: string[];
  isUnmatched?: boolean;
}
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readDir, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { Command } from "@tauri-apps/plugin-shell";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import logoDark from './assets/logo dark mode.png';
import logoWhite from './assets/logo white mode.png';

type Category = "All" | "Movie" | "TV Show" | "Anime";

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [activeGenre, setActiveGenre] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [tmdbApiKey, setTmdbApiKey] = useState(() => localStorage.getItem('tmdb_api_key') || "");
  const [tempApiKey, setTempApiKey] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Setup & API State
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(() => localStorage.getItem('rootFolder'));
  const [setupError, setSetupError] = useState<string | null>(null);
  const [mediaData, setMediaData] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFolderAccessible, setIsFolderAccessible] = useState<boolean>(true);

  // Custom Overrides (Persisted)
  const [customMatches, setCustomMatches] = useState<Record<string, { id: number, type: 'tv' | 'movie' }>>(() => {
    const saved = localStorage.getItem('customMatches');
    return saved ? JSON.parse(saved) : {};
  });
  const [customPosters, setCustomPosters] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customPosters');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('customMatches', JSON.stringify(customMatches));
  }, [customMatches]);

  useEffect(() => {
    localStorage.setItem('customPosters', JSON.stringify(customPosters));
  }, [customPosters]);

  // Modal State
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [mediaDetails, setMediaDetails] = useState<any | null>(null);
  const [localMediaFiles, setLocalMediaFiles] = useState<string[]>([]);

  // Modal Views State
  const [modalView, setModalView] = useState<'details' | 'fixMatch' | 'changePoster'>('details');
  const [fixMatchQuery, setFixMatchQuery] = useState("");
  const [fixMatchResults, setFixMatchResults] = useState<any[]>([]);
  const [changePosterResults, setChangePosterResults] = useState<any[]>([]);

  // --- Theme Classes ---
  const mainBgClass = isDarkMode ? "bg-[#0a0c10]" : "bg-[#f4f2ec]"; 
  const surfaceBgClass = isDarkMode ? "bg-[#121417]" : "bg-[#fdfbf7]"; 
  const surfaceHoverClass = isDarkMode ? "hover:bg-[#1a1d22]" : "hover:bg-[#ffffff]"; 
  
  const textClass = isDarkMode ? "text-stone-100" : "text-slate-900";
  const textMutedClass = isDarkMode ? "text-stone-400" : "text-slate-500";
  const placeholderClass = isDarkMode ? "placeholder-stone-500" : "placeholder-slate-400";
  const accentTextClass = isDarkMode ? "text-blue-400" : "text-blue-600";
  const accentBgClass = isDarkMode ? "bg-blue-400/10" : "bg-blue-600/10";
  const navHoverBgClass = isDarkMode ? "hover:bg-white/5" : "hover:bg-black/5";
  const setupBorderClass = isDarkMode ? "border-slate-700" : "border-stone-300";
  const tagBorderClass = isDarkMode ? "border-slate-700" : "border-stone-300";
  // --------------------------------------------------

  const handleBrowseFolders = async () => {
    if (!tmdbApiKey) {
      setSetupError("You must configure your TMDB API Key in Settings before importing a movie library!");
      setTempApiKey(tmdbApiKey);
      setIsSettingsOpen(true);
      return;
    }
    
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        let entries: string[] = [];
        try {
          entries = await invoke<string[]>('scan_local_dir', { path: selected });
        } catch (e) {
          setSetupError("Failed to open or read the selected folder.");
          return;
        }
        const folderNames = entries.filter(name => name && !name.startsWith('.'));
          
        if (folderNames.length === 0) {
          setSetupError("No subfolders found. Please select the root folder containing your movie folders.");
          return;
        }
        
        setSetupError(null);
        setIsFolderAccessible(true);
        localStorage.setItem('rootFolder', selected);
        setSelectedFolderPath(selected);
        const currentApiKey = localStorage.getItem('tmdb_api_key') || tmdbApiKey;
        scanDirectory(selected, currentApiKey);
      }
    } catch (error) {
      console.error("Error opening dialog:", error);
      setSetupError("Failed to open or read the selected folder.");
    }
  };

  const scanDirectory = async (folderPath: string | null | undefined, apiKey: string | null | undefined) => {
    if (!folderPath || !apiKey) {
      console.warn(`scanDirectory aborted. folderPath present: ${!!folderPath}, apiKey present: ${!!apiKey}`);
      if (!apiKey) setSetupError("TMDB API Key is missing. Please add it in Settings.");
      return;
    }

    // Ensure state matches the current scan to prevent empty dashboards
    setSelectedFolderPath(folderPath);

    setIsLoading(true);
    setMediaData([]);

    try {
      let entries: string[] = [];
      try {
        entries = await invoke<string[]>('scan_local_dir', { path: folderPath });
      } catch (err) {
        setIsFolderAccessible(false);
        setSetupError(`The folder at "${folderPath}" is missing or inaccessible.`);
        setIsLoading(false);
        return;
      }

      setIsFolderAccessible(true);
      setSetupError(null);

      const folderNames = entries.filter(name => name && !name.startsWith('.'));
        
      const fetchedItems: MediaItem[] = [];

      // Read current persisted states right before scan to avoid stale closures
      const currentCustomMatches = JSON.parse(localStorage.getItem('customMatches') || '{}');
      const currentCustomPosters = JSON.parse(localStorage.getItem('customPosters') || '{}');

      for (const name of folderNames) {
        let data;
        const override = currentCustomMatches[name] || customMatches[name];
        if (override) {
          data = await getMediaDetails(override.id, override.type);
          if (data) data.media_type = override.type; // Inject type for standard processing
        } else {
          data = await searchMovie(name);
        }

        if (data && data.poster_path) {
          let rawGenres: string[] = [];
          let isAnime = false;
          
          // Extract Genres & Detect Anime
          if (data.genre_ids) {
            rawGenres = getGenreNames(data.genre_ids);
            isAnime = data.origin_country?.includes('JP') && data.genre_ids.includes(16);
          } else if (data.genres) {
            rawGenres = data.genres.map((g: any) => g.name);
            isAnime = data.origin_country?.includes('JP') && data.genres.some((g: any) => g.id === 16);
          }

          const mediaType = isAnime ? 'Anime' : (data.media_type === 'tv' ? 'TV Show' : 'Movie');
          const finalPoster = currentCustomPosters[name] || customPosters[name] || `https://image.tmdb.org/t/p/w500${data.poster_path}`;
          const ratingStr = `⭐ ${data.vote_average ? data.vote_average.toFixed(1) : 'N/A'}`;
          
          fetchedItems.push({
            id: data.id,
            title: data.title || data.name,
            year: (data.release_date || data.first_air_date || 'N/A').substring(0, 4),
            rating: data.vote_average ? data.vote_average.toFixed(1) : 'N/A',
            type: mediaType,
            poster: finalPoster,
            folderName: name,
            rawGenres: rawGenres,
            tags: [mediaType, ratingStr, ...rawGenres.slice(0, 3)]
          });
        } else {
          let localPosterUrl = null;
          try {
            const fullPath = await join(folderPath, name);
            const innerEntries = await invoke<string[]>('scan_local_dir', { path: fullPath });
            const posterName = innerEntries.find(entryName => {
              const lower = entryName?.toLowerCase();
              return lower === 'poster.jpg' || lower === 'poster.jpeg' || lower === 'poster.png';
            });
            if (posterName) {
              const absolutePosterPath = await join(fullPath, posterName);
              localPosterUrl = convertFileSrc(absolutePosterPath);
            }
          } catch (e) {
            console.error("Error reading folder for local poster:", e);
          }

          fetchedItems.push({
            id: `unmatched-${Date.now()}-${Math.random()}`,
            title: name,
            year: 'N/A',
            rating: 'N/A',
            type: 'Movie',
            poster: localPosterUrl,
            folderName: name,
            rawGenres: [],
            tags: ['Unmatched'],
            isUnmatched: true
          });
        }
      }
      setMediaData(fetchedItems);
    } catch (error) {
      console.error("Failed to read directory or fetch metadata:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReload = () => {
    // Read up-to-date values directly from localStorage to guarantee no stale closures
    const currentFolder = localStorage.getItem('rootFolder');
    const currentApiKey = localStorage.getItem('tmdb_api_key');
    scanDirectory(currentFolder, currentApiKey);
  };

  useEffect(() => {
    const savedFolder = localStorage.getItem('rootFolder');
    const savedApiKey = localStorage.getItem('tmdb_api_key');
    if (savedFolder && savedApiKey) {
      scanDirectory(savedFolder, savedApiKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customMatches, customPosters, tmdbApiKey]);

  // Modal Fetching Effect
  useEffect(() => {
    async function fetchDetailsAndFiles() {
      if (!selectedMedia || !selectedFolderPath) return;

      setMediaDetails(null);
      setLocalMediaFiles([]);

      // Fetch TMDB Details
      const override = customMatches[selectedMedia.folderName];
      const fetchId = override ? override.id : selectedMedia.id;
      const fetchType = override ? override.type : (selectedMedia.type === 'TV Show' || selectedMedia.type === 'Anime' ? 'tv' : 'movie');

      if (!selectedMedia.isUnmatched) {
        const details = await getMediaDetails(Number(fetchId), fetchType);
        if (details) setMediaDetails(details);
      }

      // Scan local files
      try {
        const fullPath = await join(selectedFolderPath, selectedMedia.folderName);
        const entries = await invoke<string[]>('scan_local_dir', { path: fullPath });
        const validExtensions = ['.mp4', '.mkv', '.avi', '.webm'];
        
        const filePromises = entries
          .filter(name => validExtensions.some(ext => name?.toLowerCase().endsWith(ext)))
          .map(name => join(fullPath, name));
          
        const files = await Promise.all(filePromises);
        setLocalMediaFiles(files);
      } catch (error) {
        console.error("Error reading media files:", error);
      }
    }
    if (modalView === 'details') {
      fetchDetailsAndFiles();
    }
  }, [selectedMedia, selectedFolderPath, modalView, customMatches]);

  // Modal Actions
  const handleOpenFixMatch = () => {
    if (!selectedMedia) return;
    setModalView('fixMatch');
    setFixMatchQuery(selectedMedia.folderName);
    performFixMatchSearch(selectedMedia.folderName);
  };

  const performFixMatchSearch = async (query: string) => {
    const results = await searchMediaFull(query);
    setFixMatchResults(results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv'));
  };

  const handleSelectNewMatch = async (result: any) => {
    if (!selectedMedia) return;
    setCustomMatches(prev => ({ ...prev, [selectedMedia.folderName]: { id: result.id, type: result.media_type } }));
    
    // Inline update
    let rawGenres: string[] = [];
    let isAnime = false;
    if (result.genre_ids) {
      rawGenres = getGenreNames(result.genre_ids);
      isAnime = result.origin_country?.includes('JP') && result.genre_ids.includes(16);
    }
    const mediaType = isAnime ? 'Anime' : (result.media_type === 'tv' ? 'TV Show' : 'Movie');
    const newPoster = customPosters[selectedMedia.folderName] || `https://image.tmdb.org/t/p/w500${result.poster_path}`;
    const ratingStr = `⭐ ${result.vote_average ? result.vote_average.toFixed(1) : 'N/A'}`;

    setSelectedMedia((prev: any) => ({
      ...prev,
      id: result.id,
      title: result.title || result.name,
      year: (result.release_date || result.first_air_date || 'N/A').substring(0, 4),
      rating: result.vote_average ? result.vote_average.toFixed(1) : 'N/A',
      type: mediaType,
      poster: newPoster,
      rawGenres: rawGenres,
      tags: [mediaType, ratingStr, ...rawGenres.slice(0, 3)],
      isUnmatched: false
    }));
    setModalView('details');
  };

  const handleOpenChangePoster = async () => {
    if (!selectedMedia) return;
    setModalView('changePoster');
    const override = customMatches[selectedMedia.folderName];
    const fetchId = override ? override.id : selectedMedia.id;
    const fetchType = override ? override.type : (selectedMedia.type === 'TV Show' || selectedMedia.type === 'Anime' ? 'tv' : 'movie');
    
    const images = await getMediaImages(Number(fetchId), fetchType);
    setChangePosterResults(images);
  };

  const handleSelectNewPoster = (posterPath: string) => {
    if (!selectedMedia) return;
    const fullPath = `https://image.tmdb.org/t/p/w500${posterPath}`;
    setCustomPosters(prev => ({ ...prev, [selectedMedia.folderName]: fullPath }));
    setSelectedMedia((prev: any) => ({ ...prev, poster: fullPath }));
    setModalView('details');
  };

  const handleCloseModal = () => {
    setSelectedMedia(null);
    setModalView('details');
  };

  const handlePlayMedia = async (filePath: string) => {
    try {
      console.log(`Attempting to play media: ${filePath}`);
      const command = Command.create('run-mpv', [filePath]);
      const child = await command.spawn();
      console.log(`Successfully spawned mpv with PID: ${child.pid}`);
    } catch (error) {
      console.error(`Failed to play media file at ${filePath}:`, error);
    }
  };

  const availableGenres = ["All", ...Array.from(new Set(mediaData.flatMap(item => item.rawGenres || []))).sort()];

  const filteredItems = mediaData.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.type === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = activeGenre === "All" || (item.rawGenres && item.rawGenres.includes(activeGenre));
    return matchesCategory && matchesSearch && matchesGenre;
  });

  const sortedEntries = [...filteredItems].sort((a, b) => a.title.localeCompare(b.title));

  const navItems: { label: Category; icon: React.ElementType }[] = [
    { label: "All", icon: LayoutGrid },
    { label: "Movie", icon: Film },
    { label: "TV Show", icon: Tv },
    { label: "Anime", icon: Play },
  ];

  // Effect to reset activeGenre if we switch categories and the genre no longer exists
  useEffect(() => {
    if (activeGenre !== "All") {
      const categoryHasItemsWithGenre = mediaData.some(item => 
        (activeCategory === "All" || item.type === activeCategory) && 
        (item.rawGenres && item.rawGenres.includes(activeGenre))
      );
      if (!categoryHasItemsWithGenre) {
        setActiveGenre("All");
      }
    }
  }, [activeCategory, mediaData]);

  const renderSettingsModal = () => {
    if (!isSettingsOpen) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-8" onClick={() => setIsSettingsOpen(false)}>
        <div 
          className={`w-full max-w-md p-8 flex flex-col rounded-2xl ${surfaceBgClass} ${textClass} shadow-2xl relative transition-all duration-300`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-serif tracking-tight">Settings</h2>
            <button onClick={() => setIsSettingsOpen(false)} className={`p-2 rounded-full ${surfaceHoverClass}`}><X className="w-5 h-5" /></button>
          </div>
          
          <div className="mb-6">
            <label className={`block text-xs uppercase tracking-widest font-bold mb-2 ${textMutedClass}`}>TMDB API Key</label>
            <input 
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors duration-200 ${mainBgClass} ${placeholderClass} border ${tagBorderClass}`}
              placeholder="Enter your API Key..."
            />
            <p className={`text-xs mt-2 ${textMutedClass}`}>Required to fetch movie details and posters.</p>
          </div>

          <div className="mb-8">
            <label className={`block text-xs uppercase tracking-widest font-bold mb-2 ${textMutedClass}`}>Library Folder</label>
            <div className={`w-full px-4 py-3 rounded-xl flex items-center justify-between ${mainBgClass} border ${tagBorderClass}`}>
              <span className="text-sm truncate mr-4 font-medium opacity-80" dir="rtl">{selectedFolderPath || "Not Selected"}</span>
              <button 
                onClick={handleBrowseFolders}
                className={`text-xs font-medium px-4 py-2 rounded-lg ${accentBgClass} ${accentTextClass} hover:opacity-80 transition-opacity`}
              >
                Change
              </button>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={() => setIsSettingsOpen(false)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${surfaceHoverClass}`}>Cancel</button>
            <button 
              onClick={() => {
                localStorage.setItem('tmdb_api_key', tempApiKey);
                setTmdbApiKey(tempApiKey);
                setIsSettingsOpen(false);
              }} 
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };


  if (!selectedFolderPath || !isFolderAccessible) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans transition-colors duration-300 ${mainBgClass} ${textClass}`}>
        <div className={`w-full max-w-2xl p-16 flex flex-col items-center justify-center border-2 border-dashed ${setupBorderClass} rounded-2xl ${surfaceBgClass}`}>
          <FolderUp className={`w-20 h-20 mb-6 ${textMutedClass}`} strokeWidth={1.5} />
          <h2 className="text-3xl font-serif tracking-tight mb-3">
            {!isFolderAccessible ? "Library Disconnected" : "Select your Movies Library"}
          </h2>
          <p className={`text-base mb-10 text-center ${textMutedClass}`}>
            {!isFolderAccessible 
              ? `The folder at "${selectedFolderPath}" could not be accessed. Please ensure your external drive is connected or select a new folder.` 
              : "Choose the root folder containing your movie subfolders."}
          </p>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBrowseFolders}
              className={`px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md`}
            >
              Browse Folders
            </button>
            {!isFolderAccessible && (
              <button
                onClick={handleReload}
                className={`px-8 py-4 ${surfaceBgClass} border ${setupBorderClass} hover:${surfaceHoverClass} rounded-lg font-medium transition-colors duration-200 shadow-sm flex items-center`}
                disabled={isLoading}
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Retrying...' : 'Retry'}
              </button>
            )}
          </div>
          {setupError && (
            <p className="mt-6 text-sm text-red-400/90 font-medium tracking-wide text-center">
              {setupError}
            </p>
          )}
          <button
            onClick={() => { setTempApiKey(tmdbApiKey); setIsSettingsOpen(true); }}
            className={`mt-4 text-xs font-medium ${textMutedClass} hover:text-white transition-colors`}
          >
            Settings
          </button>
        </div>
        {renderSettingsModal()}
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex font-sans transition-colors duration-300 ${mainBgClass} ${textClass}`}>
      <aside className={`w-64 flex flex-col ${surfaceBgClass}`}>
        <div className="p-8">
          <img 
            src={isDarkMode ? logoDark : logoWhite} 
            alt="Arcadia Logo" 
            className="h-8 object-contain mb-1" 
          />
          <p className={`text-xs uppercase tracking-widest ${textMutedClass}`}>PERSONAL MEDIA VAULT</p>
        </div>
        <nav className="flex-1 px-4 mt-8 space-y-1">
          {navItems.map((item) => {
            const isActive = activeCategory === item.label;
            return (
              <button
                key={item.label}
                onClick={() => setActiveCategory(item.label)}
                className={`w-full flex items-center px-4 py-3 text-sm transition-all duration-200 ${
                  isActive ? `${accentTextClass} ${accentBgClass} font-medium rounded-lg` : `${textMutedClass} ${navHoverBgClass} hover:${textClass} rounded-lg`
                }`}
              >
                <item.icon className={`w-4 h-4 mr-3 ${isActive ? accentTextClass : ""}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="px-10 pt-8 pb-4 flex items-end justify-between">
          <div>
            <h2 className="text-4xl font-serif tracking-tight">{activeCategory === "All" ? "Collection" : `${activeCategory}s`}</h2>
            <p className={`text-sm mt-2 ${textMutedClass}`}>
              Showing {filteredItems.length} {filteredItems.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative w-72">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textMutedClass}`} />
              <input
                type="text"
                placeholder="Search archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors duration-200 ${surfaceBgClass} ${surfaceHoverClass} ${placeholderClass}`}
              />
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg transition-colors duration-200 ${surfaceBgClass} ${surfaceHoverClass} flex items-center justify-center`}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className={`w-5 h-5 ${accentTextClass}`} /> : <Moon className={`w-5 h-5 ${accentTextClass}`} />}
            </button>
            <button
              onClick={handleReload}
              className={`p-2 rounded-lg transition-colors duration-200 ${surfaceBgClass} ${surfaceHoverClass} flex items-center justify-center ml-2 disabled:opacity-50`}
              title="Reload Library"
              disabled={isLoading}
            >
              <RefreshCw className={`w-5 h-5 ${textMutedClass} hover:${accentTextClass} transition-colors ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button
              onClick={() => { setTempApiKey(tmdbApiKey); setIsSettingsOpen(true); }}
              className={`p-2 rounded-lg transition-colors duration-200 ${surfaceBgClass} ${surfaceHoverClass} flex items-center justify-center ml-2`}
              aria-label="Settings"
            >
              <Settings className={`w-5 h-5 ${textMutedClass} hover:${accentTextClass} transition-colors`} />
            </button>
          </div>
        </header>

        {/* Dynamic Genre Filter Bar */}
        {availableGenres.length > 1 && (
          <div className="px-10 pb-4 flex space-x-2 overflow-x-auto scrollbar-hide flex-shrink-0">
             {availableGenres.map(genre => (
               <button 
                 key={genre}
                 onClick={() => setActiveGenre(genre as string)}
                 className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wider transition-colors border ${tagBorderClass} ${
                   activeGenre === genre 
                     ? `${accentBgClass} ${accentTextClass} border-transparent` 
                     : `${textMutedClass} ${surfaceHoverClass}`
                 }`}
               >
                 {genre as string}
               </button>
             ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-10 pt-4">
          {isLoading ? (
            <div className={`flex flex-col items-center justify-center h-full ${textMutedClass}`}>
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-serif">Syncing with TMDB...</p>
            </div>
          ) : sortedEntries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
              {sortedEntries.map((item) => (
                <div 
                  key={item.folderName} 
                  onClick={() => setSelectedMedia(item)}
                  className={`group cursor-pointer p-4 rounded-xl ${surfaceBgClass} ${surfaceHoverClass} transition-colors duration-300`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-[#16181d]">
                    {item.poster ? (
                      <img src={item.poster} alt={item.title} className="w-full h-full object-cover transition-all duration-500 group-hover:opacity-90 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 border border-slate-700/50">
                        <ImageOff className="w-12 h-12 text-slate-500 mb-2" />
                        <span className="text-xs text-slate-400 font-medium px-4 text-center truncate w-full">{item.folderName}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 pointer-events-none" />
                  </div>
                  <div className="mt-5 flex items-baseline justify-between">
                    <h3 className="text-lg font-serif tracking-tight truncate pr-4">{item.title}</h3>
                    <span className={`text-xs ${textMutedClass}`}>{item.year}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.tags.map((tag: string) => (
                      <span key={tag} className={`px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded-full ${tagBorderClass} ${textMutedClass} bg-transparent`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className={`flex flex-col items-center justify-center h-full ${textMutedClass}`}>
              <Search className="w-8 h-8 mb-4 opacity-50" />
              <p className="text-sm font-serif">No entries found matching your query.</p>
            </div>
          )}
        </div>

        {/* Modal Overlay */}
        {selectedMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-8" onClick={handleCloseModal}>
            <div 
              className={`w-full max-w-5xl max-h-[90vh] flex overflow-hidden rounded-2xl ${surfaceBgClass} ${textClass} shadow-2xl relative transition-all duration-300`}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={handleCloseModal}
                className={`absolute top-4 right-4 p-2 rounded-full ${surfaceHoverClass} transition-colors z-10`}
              >
                <X className={`w-6 h-6 ${textMutedClass}`} />
              </button>

              {/* Left Column: Poster (Always Visible in Modal) */}
              <div className="w-1/3 min-w-[300px] hidden md:block relative bg-[#16181d]">
                {selectedMedia.poster ? (
                  <img src={selectedMedia.poster} alt={selectedMedia.title} className="w-full h-full object-cover transition-opacity duration-300" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 border-r border-slate-700/50">
                    <ImageOff className="w-16 h-16 text-slate-500 mb-4" />
                    <span className="text-sm text-slate-400 font-medium px-4 text-center">No Poster Available</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
              </div>

              {/* Right Column: Dynamic Content */}
              <div className="flex-1 flex flex-col p-10 overflow-y-auto">
                
                {modalView === 'details' && (
                  <div className="animate-in fade-in duration-300 flex flex-col h-full">
                    {/* Utility Bar */}
                    <div className="flex justify-end mb-4 space-x-6">
                      <button onClick={handleOpenFixMatch} className={`flex items-center text-[11px] font-medium uppercase tracking-wider transition-colors duration-200 ${textMutedClass} hover:${accentTextClass}`}>
                        <RefreshCw className="w-3 h-3 mr-2" /> Fix Match
                      </button>
                      <button onClick={handleOpenChangePoster} className={`flex items-center text-[11px] font-medium uppercase tracking-wider transition-colors duration-200 ${textMutedClass} hover:${accentTextClass}`}>
                        <ImageIcon className="w-3 h-3 mr-2" /> Change Poster
                      </button>
                    </div>

                    <h2 className="text-4xl font-serif tracking-tight mb-2 pr-12">{selectedMedia.title}</h2>
                    
                    <div className="flex items-center flex-wrap gap-4 mb-6">
                      {!selectedMedia.isUnmatched && <span className={`text-sm font-medium ${textMutedClass}`}>{selectedMedia.year}</span>}
                      <div className="flex gap-2">
                        {selectedMedia.tags.map((tag: string) => (
                          <span key={tag} className={`px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded-full ${tagBorderClass} ${textMutedClass} bg-transparent`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      {!selectedMedia.isUnmatched && mediaDetails?.number_of_seasons && (
                        <span className={`text-sm font-medium ${textMutedClass}`}>
                          • {mediaDetails.number_of_seasons} Seasons, {mediaDetails.number_of_episodes} Episodes
                        </span>
                      )}
                    </div>

                    <p className={`text-base leading-relaxed mb-8 ${textMutedClass}`}>
                      {selectedMedia.isUnmatched 
                        ? "This local folder could not be matched with TMDB. Click 'Fix Match' to manually search and assign metadata." 
                        : (mediaDetails ? mediaDetails.overview || "No overview available." : "Fetching details from TMDB...")}
                    </p>

                    {!selectedMedia.isUnmatched && mediaDetails?.credits?.cast && mediaDetails.credits.cast.length > 0 && (
                      <div className="mb-8">
                        <h3 className={`text-xs uppercase tracking-widest font-bold mb-4 ${textMutedClass}`}>Top Cast</h3>
                        <div className="flex overflow-x-auto space-x-6 pb-2 scrollbar-hide">
                          {mediaDetails.credits.cast.slice(0, 7).map((actor: any) => (
                            <div key={actor.id} className="flex flex-col items-center flex-shrink-0 w-20">
                              <div className={`w-16 h-16 rounded-full overflow-hidden bg-[#16181d] mb-2 border ${tagBorderClass}`}>
                                {actor.profile_path ? (
                                  <img src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`} alt={actor.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-stone-500">N/A</div>
                                )}
                              </div>
                              <span className="text-xs text-center line-clamp-2 leading-tight">{actor.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pt-6">
                      <h3 className={`text-xs uppercase tracking-widest font-bold mb-4 ${textMutedClass}`}>Available Local Files</h3>
                      {localMediaFiles.length > 0 ? (
                        <div className="space-y-2">
                          {localMediaFiles.map((file, idx) => {
                            const fileName = file.split(/[\\/]/).pop();
                            return (
                                <button
                                  key={idx}
                                  onClick={() => handlePlayMedia(file)}
                                  className={`w-full flex items-center p-4 rounded-xl transition-colors border ${tagBorderClass} ${surfaceHoverClass} group cursor-pointer`}
                                >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${accentBgClass} group-hover:scale-110 transition-transform`}>
                                  <Play className={`w-4 h-4 fill-current ${accentTextClass}`} />
                                </div>
                                <span className="text-sm font-medium truncate flex-1 text-left">{fileName}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className={`flex items-center p-4 rounded-xl border border-dashed ${tagBorderClass} ${textMutedClass}`}>
                          <p className="text-sm">Scanning directory for video files...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {modalView === 'fixMatch' && (
                  <div className="animate-in fade-in duration-300 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-serif tracking-tight">Fix Match</h2>
                      <button onClick={() => setModalView('details')} className={`text-xs uppercase tracking-wider font-medium transition-colors ${textMutedClass} hover:${textClass}`}>
                        Cancel
                      </button>
                    </div>
                    
                    <div className="relative w-full mb-6 flex-shrink-0">
                      <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${textMutedClass}`} />
                      <input 
                        type="text" 
                        value={fixMatchQuery}
                        onChange={(e) => setFixMatchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performFixMatchSearch(fixMatchQuery)}
                        className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors duration-200 ${surfaceBgClass} ${surfaceHoverClass} ${placeholderClass} border ${tagBorderClass}`}
                        placeholder="Search for the correct match..."
                        autoFocus
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {fixMatchResults.length > 0 ? fixMatchResults.map(res => (
                        <button 
                          key={res.id} 
                          onClick={() => handleSelectNewMatch(res)}
                          className={`w-full flex items-center p-3 rounded-xl transition-colors border ${tagBorderClass} ${surfaceHoverClass} text-left`}
                        >
                          <div className="w-12 h-16 bg-[#16181d] rounded overflow-hidden flex-shrink-0 mr-4 border border-white/5">
                            {res.poster_path ? (
                              <img src={`https://image.tmdb.org/t/p/w200${res.poster_path}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-500">N/A</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate text-sm mb-1">{res.title || res.name}</h4>
                            <span className={`text-xs ${textMutedClass}`}>{(res.release_date || res.first_air_date || 'N/A').substring(0,4)}</span>
                          </div>
                          <div className={`px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded-full ${tagBorderClass} ${textMutedClass} bg-transparent ml-4`}>
                            {res.media_type === 'tv' ? 'TV Show' : 'Movie'}
                          </div>
                        </button>
                      )) : (
                        <p className={`text-sm text-center mt-10 ${textMutedClass}`}>Press Enter to search TMDB for alternative matches.</p>
                      )}
                    </div>
                  </div>
                )}

                {modalView === 'changePoster' && (
                  <div className="animate-in fade-in duration-300 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-serif tracking-tight">Change Poster</h2>
                      <button onClick={() => setModalView('details')} className={`text-xs uppercase tracking-wider font-medium transition-colors ${textMutedClass} hover:${textClass}`}>
                        Cancel
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2">
                      {changePosterResults.length > 0 ? (
                        <div className="grid grid-cols-3 gap-4">
                          {changePosterResults.map((poster, idx) => (
                            <button 
                              key={idx}
                              onClick={() => handleSelectNewPoster(poster.file_path)}
                              className={`aspect-[2/3] rounded-lg overflow-hidden relative group border ${tagBorderClass}`}
                            >
                              <img src={`https://image.tmdb.org/t/p/w500${poster.file_path}`} className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-70" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="text-white text-xs font-medium bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">Select</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                           <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}


      </main>
      {renderSettingsModal()}
    </div>
  );
}