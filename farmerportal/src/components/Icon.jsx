import {
  ArrowRight, Bell, CircleCheck, ClipboardList, CloudSun, Inbox, OctagonAlert, Camera, Carrot, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock, Cloud,
  CloudLightning, CloudRain, Construction, Droplet, Droplets, Ellipsis, ExternalLink, Fence, Globe, House, Info, Leaf,
  LocateFixed, Lock, LogOut,
  Map, MapPin, MessageSquareText, Mic, Newspaper, Plus, RefreshCw, Search, Send, Sparkles, SquarePen, Sun,
  Trash2, TriangleAlert, User, Waves, WifiOff, Wind, X, Undo2, Footprints, Pentagon,
} from 'lucide-react';

// Outline crop icons tailored for agricultural varieties (paddy sheaf, vegetable pepper, fruit, mixed plot)
function PaddyIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style} className={className}>
      <path d="M4 21c2.5-3.5 5.5-8 7.5-14" />
      <path d="M13 5c1.5-1.5 4-1 4.5.5s-2 2.5-4.5 1" />
      <path d="M11 8c2-1 4.2.2 3.8 2s-2.8 1.5-4.2.5" />
      <path d="M9 9.5c-2-1-3.8.2-3.2 2s3 1.2 4.2-.3" />
      <path d="M10 12c2.2-.8 4 .5 3.5 2.2s-2.8 1.5-4.2.3" />
      <path d="M8 13.5c-2.2-.8-3.8.5-3.2 2.2s3 1.2 4.2-.3" />
      <path d="M9 16c2-.8 3.5.5 3.2 2s-2.5 1.2-3.8.2" />
    </svg>
  );
}

function VegetableIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style} className={className}>
      <path d="M12 2c0 1.8-.8 3.2-2.2 4.2" />
      <path d="M7.5 7c1.8.8 5.2.8 7 0" />
      <path d="M8 7.5C7.2 11.2 7.5 15.8 10 18.8c1.4 1.7 3.2 2.7 3.8 3.2.2-2.2 1-4.8 1.5-7.8C16 11 15 8 14.2 7.5" />
    </svg>
  );
}

function FruitIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style} className={className}>
      <path d="M12 2c0 2-1 3.5-2.5 4" />
      <path d="M12 4.5c2-1.5 4.5-1 5 .5s-1.5 3-4 2" />
      <path d="M9.5 6C6.5 7 5 10 5 14c0 4.5 3 7 7 7s7-2.5 7-7c0-4-2-7-5.5-8" />
    </svg>
  );
}

function MixedIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style} className={className}>
      <path d="M12 22v-9" />
      <path d="M12 13c-3-4-7-3-8 1 3 2 7 0 8-1" />
      <path d="M12 11c3-4 7-3 8 1-3 2-7 0-8-1" />
      <path d="M12 17c-2-2-4.5-1.5-5 .5 1.5 1 4 0 5-.5" />
      <path d="M12 15c2-2 4.5-1.5 5 .5-1.5 1-4 0-5-.5" />
    </svg>
  );
}

// App icon names → Lucide, a standard open-source set close to SF Symbols' outline style.
// (SF Symbols themselves are licensed for Apple-platform apps only, so they can't ship on the web.)
const P = {
  leaf: PaddyIcon,
  paddy: PaddyIcon,
  vegetables: VegetableIcon,
  fruit: FruitIcon,
  mixed: MixedIcon,
  bell: Bell,
  warn: TriangleAlert,
  arrow: ArrowRight,
  back: ChevronLeft,
  close: X,
  chevron: ChevronRight,
  down: ChevronDown,
  pin: MapPin,
  drop: Droplet,
  home: House,
  plus: Plus,
  map: Map,
  user: User,
  sun: Sun,
  cloud: Cloud,
  rain: CloudRain,
  spark: Sparkles,
  sms: MessageSquareText,
  check: Check,
  blockage: Construction,
  leak: Droplets,
  gate: Fence,
  dots: Ellipsis,
  camera: Camera,
  mic: Mic,
  send: Send,
  trash: Trash2,
  pencil: SquarePen,
  lock: Lock,
  search: Search,
  info: Info,
  clock: Clock,
  target: LocateFixed,
  refresh: RefreshCw,
  globe: Globe,
  help: CircleHelp,
  logout: LogOut,
  wifiOff: WifiOff,
  tank: Waves,
  chilli: VegetableIcon,
  cloudSun: CloudSun,
  checkCircle: CircleCheck,
  stop: OctagonAlert,
  inbox: Inbox,
  news: Newspaper,
  wind: Wind,
  cloudLightning: CloudLightning,
  external: ExternalLink,
  undo: Undo2,
  walk: Footprints,
  shape: Pentagon,
  survey: ClipboardList,
};

export default function Icon({ name, size = 20, color = 'currentColor', stroke = 2, style, className }) {
  const Glyph = P[name] || Ellipsis;
  return <Glyph size={size} color={color} strokeWidth={stroke} aria-hidden="true" style={style} className={className} />;
}
