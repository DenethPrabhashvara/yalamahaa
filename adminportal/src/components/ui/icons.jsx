import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faAnglesLeft,
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowTrendDown,
  faArrowTrendUp,
  faArrowTurnDown,
  faArrowUp,
  faArrowUpRightFromSquare,
  faArrowsRotate,
  faArrowsUpDown,
  faBars,
  faBell,
  faBellSlash,
  faBullhorn,
  faCalendarCheck,
  faCalendarDays,
  faCamera,
  faChartLine,
  faCheck,
  faCheckDouble,
  faChevronDown,
  faChevronRight,
  faChevronUp,
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faCircleXmark,
  faClipboard,
  faClipboardCheck,
  faClipboardList,
  faClock,
  faCloudRain,
  faCloudBolt,
  faCommentSms,
  faDatabase,
  faDownload,
  faDroplet,
  faEye,
  faEyeSlash,
  faFileExcel,
  faFlask,
  faFloppyDisk,
  faGear,
  faGauge,
  faGaugeHigh,
  faInbox,
  faKey,
  faLeaf,
  faList,
  faLocationDot,
  faLock,
  faMagnifyingGlass,
  faMoon,
  faPaperPlane,
  faPalette,
  faPen,
  faPhone,
  faPhoneSlash,
  faPhoneVolume,
  faPlay,
  faPlus,
  faRadio,
  faRightFromBracket,
  faRotateLeft,
  faRuler,
  faSeedling,
  faShield,
  faShieldHalved,
  faSignal,
  faSpinner,
  faStar,
  faSun,
  faTable,
  faTableCellsLarge,
  faTrash,
  faTowerBroadcast,
  faTriangleExclamation,
  faUser,
  faUserCheck,
  faUserPlus,
  faUserXmark,
  faUsers,
  faWater,
  faWheatAwn,
  faWifi,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'

function createIcon(icon) {
  function SolidIcon({ size = 16, className, style, ...props }) {
    return (
      <FontAwesomeIcon
        icon={icon}
        className={className}
        style={{ fontSize: size, ...style }}
        {...props}
      />
    )
  }
  SolidIcon.displayName = `SolidIcon(${icon.iconName})`
  return SolidIcon
}

export const AlertTriangle = createIcon(faTriangleExclamation)
export const ArrowDown = createIcon(faArrowDown)
export const ArrowDownRight = createIcon(faArrowTrendDown)
export const ArrowLeft = createIcon(faArrowLeft)
export const ArrowRight = createIcon(faArrowRight)
export const ArrowUp = createIcon(faArrowUp)
export const ArrowUpDown = createIcon(faArrowsUpDown)
export const ArrowUpRight = createIcon(faArrowTrendUp)
export const Bell = createIcon(faBell)
export const BellOff = createIcon(faBellSlash)
export const BellRing = createIcon(faBell)
export const CalendarClock = createIcon(faCalendarCheck)
export const CalendarDays = createIcon(faCalendarDays)
export const Camera = createIcon(faCamera)
export const Check = createIcon(faCheck)
export const CheckCheck = createIcon(faCheckDouble)
export const CheckCircle2 = createIcon(faCircleCheck)
export const ChevronDown = createIcon(faChevronDown)
export const ChevronRight = createIcon(faChevronRight)
export const ChevronUp = createIcon(faChevronUp)
export const ChevronsLeft = createIcon(faAnglesLeft)
export const ClipboardCheck = createIcon(faClipboardCheck)
export const ClipboardList = createIcon(faClipboardList)
export const ClipboardPlus = createIcon(faClipboard)
export const Clock3 = createIcon(faClock)
export const CloudRain = createIcon(faCloudRain)
export const CloudLightning = createIcon(faCloudBolt)
export const CornerDownLeft = createIcon(faArrowTurnDown)
export const Database = createIcon(faDatabase)
export const Download = createIcon(faDownload)
export const Droplets = createIcon(faDroplet)
export const Eye = createIcon(faEye)
export const EyeOff = createIcon(faEyeSlash)
export const ExternalLink = createIcon(faArrowUpRightFromSquare)
export const FileSpreadsheet = createIcon(faFileExcel)
export const FlaskConical = createIcon(faFlask)
export const Gauge = createIcon(faGauge)
export const Inbox = createIcon(faInbox)
export const Info = createIcon(faCircleInfo)
export const KeyRound = createIcon(faKey)
export const LayoutDashboard = createIcon(faGaugeHigh)
export const LayoutGrid = createIcon(faTableCellsLarge)
export const Leaf = createIcon(faLeaf)
export const List = createIcon(faList)
export const Loader2 = createIcon(faSpinner)
export const Lock = createIcon(faLock)
export const LockKeyhole = createIcon(faLock)
export const LogOut = createIcon(faRightFromBracket)
export const MapPin = createIcon(faLocationDot)
export const Megaphone = createIcon(faBullhorn)
export const Menu = createIcon(faBars)
export const MessageSquareText = createIcon(faCommentSms)
export const Moon = createIcon(faMoon)
export const Palette = createIcon(faPalette)
export const Pencil = createIcon(faPen)
export const PhoneCall = createIcon(faPhoneVolume)
export const PhoneOff = createIcon(faPhoneSlash)
export const Play = createIcon(faPlay)
export const Plus = createIcon(faPlus)
export const Radio = createIcon(faRadio)
export const RefreshCw = createIcon(faArrowsRotate)
export const RotateCcw = createIcon(faRotateLeft)
export const Ruler = createIcon(faRuler)
export const Save = createIcon(faFloppyDisk)
export const Search = createIcon(faMagnifyingGlass)
export const Send = createIcon(faPaperPlane)
export const Settings = createIcon(faGear)
export const ShieldAlert = createIcon(faShield)
export const ShieldCheck = createIcon(faShieldHalved)
export const Signal = createIcon(faSignal)
export const Smartphone = createIcon(faPhone)
export const Sparkles = createIcon(faStar)
export const Sprout = createIcon(faSeedling)
export const Sun = createIcon(faSun)
export const Table2 = createIcon(faTable)
export const Trash2 = createIcon(faTrash)
export const TrendingUp = createIcon(faChartLine)
export const UserCheck = createIcon(faUserCheck)
export const UserPlus = createIcon(faUserPlus)
export const UserRound = createIcon(faUser)
export const UserX = createIcon(faUserXmark)
export const Users = createIcon(faUsers)
export const Waves = createIcon(faWater)
export const Wheat = createIcon(faWheatAwn)
export const Wifi = createIcon(faWifi)
export const X = createIcon(faXmark)
export const XCircle = createIcon(faCircleXmark)
