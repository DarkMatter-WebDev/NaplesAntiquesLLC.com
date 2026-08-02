import {
  Anvil,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BadgeDollarSign,
  Bell,
  Camera,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CirclePlay,
  CircleStop,
  Coins,
  Crop,
  Eye,
  FilePenLine,
  FileText,
  FlaskConical,
  Gavel,
  Gem,
  Gift,
  Grid2X2,
  GripVertical,
  Heart,
  House,
  Image,
  ImagePlus,
  Info,
  KeyRound,
  Keyboard,
  List,
  ListFilter,
  Lock,
  Mail,
  MailWarning,
  MapPin,
  Menu,
  Mic,
  Microscope,
  Minus,
  Package,
  PanelLeftClose,
  Pencil,
  Phone,
  PhoneCall,
  PiggyBank,
  Pipette,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Trash2,
  TriangleAlert,
  Trophy,
  Undo2,
  User,
  UserPlus,
  UsersRound,
  Utensils,
  Video,
  Volume2,
  Watch,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties, SVGProps } from 'react';

/**
 * The names intentionally match the legacy icon identifiers.
 * Keeping the translation in one place lets existing data-driven icon names
 * remain stable while rendering content-hashed inline SVGs instead of a
 * separately cached ligature font.
 */
export const APP_ICONS = {
  add: Plus,
  add_photo_alternate: ImagePlus,
  add_shopping_cart: ShoppingCart,
  admin_panel_settings: ShieldCheck,
  arrow_drop_down: ChevronDown,
  arrow_drop_up: ChevronUp,
  arrow_outward: ArrowUpRight,
  auto_awesome: Sparkles,
  biotech: Microscope,
  call: Phone,
  check: Check,
  check_circle: CircleCheck,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  colorize: Pipette,
  crop: Crop,
  delete: Trash2,
  description: FileText,
  diamond: Gem,
  dining: Utensils,
  draft: FilePenLine,
  drag_indicator: GripVertical,
  edit: Pencil,
  edit_note: FilePenLine,
  error: CircleAlert,
  expand_less: ChevronUp,
  expand_more: ChevronDown,
  family_restroom: UsersRound,
  favorite: Heart,
  filter_list: ListFilter,
  gavel: Gavel,
  grid_view: Grid2X2,
  home: House,
  image: Image,
  info: Info,
  inventory_2: Package,
  iron: Anvil,
  keyboard: Keyboard,
  location_on: MapPin,
  lock: Lock,
  lock_reset: KeyRound,
  mail: Mail,
  mark_email_unread: MailWarning,
  menu: Menu,
  menu_open: PanelLeftClose,
  mic: Mic,
  monitoring: ChartNoAxesCombined,
  notifications: Bell,
  paid: BadgeDollarSign,
  payments: CircleDollarSign,
  person: User,
  person_add: UserPlus,
  phone_in_talk: PhoneCall,
  photo_camera: Camera,
  play_circle: CirclePlay,
  print: Printer,
  receipt_long: ReceiptText,
  redeem: Gift,
  remove: Minus,
  remove_shopping_cart: ShoppingCart,
  savings: PiggyBank,
  scale: Scale,
  science: FlaskConical,
  sell: BadgeDollarSign,
  shopping_bag: ShoppingBag,
  star: Star,
  stop_circle: CircleStop,
  store: Store,
  sync: RefreshCw,
  toll: Coins,
  trending_flat: ArrowRight,
  undo: Undo2,
  verified: BadgeCheck,
  verified_user: ShieldCheck,
  videocam: Video,
  view_list: List,
  visibility: Eye,
  volume_up: Volume2,
  warning: TriangleAlert,
  watch: Watch,
  '🏆': Trophy,
  '💛': Heart,
  '📞': Phone,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof APP_ICONS;

interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: AppIconName | string;
}

export function AppIcon({
  name,
  className,
  style,
  fill,
  strokeWidth = 1.8,
  'aria-hidden': ariaHidden = true,
  ...props
}: AppIconProps) {
  const Icon = APP_ICONS[name as AppIconName];

  // Missing icon data must never become visible ligature text. Static usages
  // are also checked by the regression test, while data-driven unknowns fail
  // safely by omitting the decorative graphic.
  if (!Icon) return null;

  const fontVariationSettings = style?.fontVariationSettings;
  const shouldFill = typeof fontVariationSettings === 'string'
    && /(?:^|[,\s])['"]?FILL['"]?\s+1(?:$|[,\s])/.test(fontVariationSettings);
  const svgStyle = style
    ? ({ ...style, fontVariationSettings: undefined } satisfies CSSProperties)
    : undefined;

  return (
    <Icon
      {...props}
      aria-hidden={ariaHidden}
      className={['app-icon', className].filter(Boolean).join(' ')}
      fill={fill ?? (shouldFill ? 'currentColor' : 'none')}
      focusable="false"
      size="1em"
      strokeWidth={strokeWidth}
      style={svgStyle}
    />
  );
}
