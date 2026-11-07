// Fixed lists and text for the app. Live data (tanks, forecasts, river gauges, water issue
// schedule, rain) comes from the API and Open-Meteo: see src/api/.


// Sri Lankan Department of Agriculture varieties. Paddy is grouped by age because that is how a
// variety is picked for the season: in a name like Bg 352 the first digit is the months to harvest
// and a second digit of 5-9 adds half a month (Bg = Batalagoda, At = Ambalantota, Bw = Bombuwela,
// Ld = Labuduwa). Every type ends with 'Other / local seed' for anything not listed.
const OTHER = 'Other / local seed';
export const CROP_CATALOG = {
  paddy: {
    label: 'Paddy (Rice)', color: '#6E8F3A',
    types: {
      '3.5 months': ['Bg 352', 'Bg 359', 'Bg 360', 'Bg 366', 'Bg 357', 'Bg 358', 'Bg 94-1', 'At 362', 'At 353', 'At 373', 'Bw 361', 'Ld 365', 'Ld 368', OTHER],
      '3 months': ['Bg 300', 'Bg 304', 'Bg 305', 'Bg 310', 'At 306', 'At 307', 'At 308', OTHER],
      '2.5 months': ['Bg 250', OTHER],
      '4-4.5 months': ['Bg 379-2', 'Bg 403', 'Bg 406', 'Bg 450', 'Bg 454', 'At 405', 'Ld 408', OTHER],
      Traditional: ['Suwandel', 'Pachchaperumal', 'Kalu Heenati', 'Madathawalu', 'Kuruluthudu', 'Rathdel', 'Herath Banda', 'Kahata Samba', 'Murungakayan', OTHER],
    },
  },
  vegetables: {
    label: 'Vegetables', color: '#E08A1E',
    types: {
      Tomato: ['Thilina', 'Maheshi', 'T-245', 'Rashmi', 'Padmini', 'Bhathiya', OTHER],
      'Green Chilli': ['MI 1', 'MI 2', 'MI Hot', 'KA 2', 'Arunalu', OTHER],
      Brinjal: ['Lena Iri', 'Padagoda', 'Thinnaveli Purple', 'SM 164', 'Amanda', OTHER],
      'Okra (Bandakka)': ['MI 5', 'MI 7', 'Haritha', OTHER],
      'Bitter gourd (Karawila)': ['MC 43', 'Matale Green', 'Thinnaveli White', OTHER],
      'Long bean (Me)': ['Polon Me', 'Hawari Me', OTHER],
      'Red onion': ['Vethalan', OTHER],
    },
  },
  fruit: {
    label: 'Fruit', color: '#D93B2B',
    types: {
      Banana: ['Ambul', 'Kolikuttu', 'Seeni', 'Anamalu', 'Rathambala', 'Cavendish', OTHER],
      Papaya: ['Red Lady', 'Rathna', OTHER],
      Mango: ['Karthakolomban', 'Willard', 'TJC', OTHER],
      Pineapple: ['Mauritius', 'Kew', OTHER],
      Watermelon: ['Sugar Baby', OTHER],
    },
  },
  mixed: {
    label: 'Mixed Farming', short: 'Mixed', color: '#2F6FE0',
    types: { 'Mixed plot': ['Home garden mix', 'Vegetable + fruit'] },
  },
};

export const YIELD_UNITS = [
  { id: 'kg', label: 'kg / acre' },
  { id: 'bu', label: 'bushels / ac' },
  { id: 't', label: 'tons / acre' },
];

export const ISSUE_TYPES = [
  { id: 'blockage', key: 'blockage', icon: 'blockage' },
  { id: 'leak', key: 'leak', icon: 'leak' },
  { id: 'gate', key: 'gate', icon: 'gate' },
  { id: 'other', key: 'other', icon: 'dots' },
];

// Real photos (Wikimedia Commons, credits in public/photos/CREDITS.md).
const photo = (f) => `${import.meta.env.BASE_URL}photos/${f}`;
export const PHOTOS = {
  paddy: photo('paddy.jpg'),
  farmers: photo('farmers.jpg'),
  tank: photo('tank.jpg'),
  canal: photo('canal.jpg'),
  flood: photo('flood.jpg'),
  harvest: photo('harvest.jpg'),
};

// Where a farmer's field gets its water (registration step 2c).
export const WATER_SOURCES = [
  { id: 'tank', key: 'wsTank', icon: 'tank', ask: 'tank' },
  { id: 'canal', key: 'wsCanal', icon: 'drop', ask: 'canal' },
  { id: 'river', key: 'wsRiver', icon: 'leak', ask: 'river' },
  { id: 'well', key: 'wsWell', icon: 'target' },
  { id: 'rain', key: 'wsRain', icon: 'rain' },
];


// Where the maps open when the farm has no pin yet: the whole island (farms can be anywhere in Sri Lanka).
export const MAP_CENTER = { lat: 7.87, lng: 80.77 };
export const MAP_ZOOM = 8;
// The maps only show Sri Lanka: tiles load only inside this box (the island plus a little sea), and
// panning and zooming out stop at it. Sri Lanka's land ends about 79.7 E (Mannar, Kalpitiya) and
// 9.83 N (Point Pedro); the box stops short of India's coast (Rameswaram 79.3 E, Kodiakkarai 10.3 N).
export const SRI_LANKA_BOUNDS = { south: 5.75, west: 79.6, north: 9.95, east: 82.0 };
// Tank names are hidden when zoomed out further than this: at island scale 117 names pile on top of each other.
export const TANK_LABEL_MIN_ZOOM = 11;

export const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna',
  'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
  'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];
