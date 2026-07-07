export function getApiKey() {
  return localStorage.getItem('tmdb_api_key') || import.meta.env.VITE_TMDB_API_KEY || '';
}

const BASE_URL = 'https://api.themoviedb.org/3';

export async function searchMovie(title: string) {
  try {
    const response = await fetch(
      `${BASE_URL}/search/multi?api_key=${getApiKey()}&query=${encodeURIComponent(title)}`
    );
    
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0]; // بنرجع أول وأدق نتيجة
    }
    return null;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

export async function getMediaDetails(id: number, type: 'tv' | 'movie') {
  try {
    const response = await fetch(
      `${BASE_URL}/${type}/${id}?api_key=${getApiKey()}&append_to_response=credits`
    );

    if (!response.ok) throw new Error('Network response was not ok');

    return await response.json();
  } catch (error) {
    console.error("Error fetching media details:", error);
    return null;
  }
}

export async function searchMediaFull(title: string) {
  try {
    const response = await fetch(
      `${BASE_URL}/search/multi?api_key=${getApiKey()}&query=${encodeURIComponent(title)}`
    );
    
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    
    return data.results || [];
  } catch (error) {
    console.error("Error fetching full search data:", error);
    return [];
  }
}

export async function getMediaImages(id: number, type: 'tv' | 'movie') {
  try {
    const response = await fetch(
      `${BASE_URL}/${type}/${id}/images?api_key=${getApiKey()}`
    );

    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    return data.posters || [];
  } catch (error) {
    console.error("Error fetching media images:", error);
    return [];
  }
}

const TMDB_GENRES: Record<number, string> = {
  // Movies
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  // TV specific
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

export function getGenreNames(ids: number[]): string[] {
  if (!ids) return [];
  return ids.map(id => TMDB_GENRES[id]).filter(Boolean);
}