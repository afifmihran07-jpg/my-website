import {
  Activity,
  BookMarked,
  BookOpen,
  Briefcase,
  CalendarDays,
  Clock,
  FolderKanban,
  GraduationCap,
  HandHeart,
  HelpCircle,
  History,
  Image,
  LayoutDashboard,
  LineChart,
  ListTodo,
  MoonStar,
  NotebookPen,
  Pill,
  Puzzle,
  Rocket,
  Settings,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Waypoints,
  Bell,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** phase in the build plan — surfaced in the UI so nothing pretends to exist */
  phase: number;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Academic",
    icon: GraduationCap,
    items: [
      { href: "/academic", label: "Overview", icon: GraduationCap, phase: 4 },
      { href: "/academic/semesters", label: "Semesters", icon: CalendarDays, phase: 4 },
      { href: "/academic/courses", label: "Courses", icon: BookOpen, phase: 4 },
      { href: "/academic/grades", label: "Grades", icon: Target, phase: 4 },
      { href: "/academic/resources", label: "Resources", icon: FolderKanban, phase: 4 },
      { href: "/academic/achievements", label: "Achievements", icon: Trophy, phase: 5 },
    ],
  },
  {
    label: "Productivity",
    icon: ListTodo,
    items: [
      { href: "/today", label: "Today", icon: Clock, phase: 2 },
      { href: "/tasks", label: "Tasks", icon: ListTodo, phase: 2 },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, phase: 2 },
      { href: "/study", label: "Study Timer", icon: Timer, phase: 2 },
      { href: "/study/history", label: "Study History", icon: History, phase: 2 },
      { href: "/reminders", label: "Reminders", icon: Bell, phase: 3 },
    ],
  },
  {
    label: "Learning",
    icon: BookMarked,
    items: [
      { href: "/learning/books", label: "Books", icon: BookOpen, phase: 5 },
      { href: "/learning/notes", label: "Notes", icon: NotebookPen, phase: 6 },
      { href: "/learning/questions", label: "Questions", icon: HelpCircle, phase: 6 },
      { href: "/learning/skills", label: "Skills", icon: Puzzle, phase: 6 },
      { href: "/learning/polymath", label: "Polymath", icon: Waypoints, phase: 6 },
    ],
  },
  {
    label: "Opportunities",
    icon: Rocket,
    items: [
      { href: "/opportunities?type=competition", label: "Competitions", icon: Trophy, phase: 5 },
      { href: "/opportunities?type=hackathon", label: "Hackathons", icon: Rocket, phase: 5 },
      { href: "/opportunities?type=scholarship", label: "Scholarships", icon: GraduationCap, phase: 5 },
      { href: "/opportunities?type=internship", label: "Internships", icon: Briefcase, phase: 5 },
      { href: "/opportunities?type=research", label: "Research", icon: BookMarked, phase: 5 },
      { href: "/opportunities?type=conference", label: "Conferences", icon: HandHeart, phase: 5 },
    ],
  },
  {
    label: "Life",
    icon: HandHeart,
    items: [
      { href: "/life/activities", label: "Activities", icon: Activity, phase: 7 },
      { href: "/life/prayer", label: "Prayer", icon: MoonStar, phase: 7 },
      { href: "/life/medication", label: "Medication", icon: Pill, phase: 7 },
      { href: "/life/diary", label: "Diary", icon: NotebookPen, phase: 7 },
      { href: "/life/photos", label: "Photos", icon: Image, phase: 7 },
      { href: "/life/timeline", label: "Timeline", icon: History, phase: 7 },
    ],
  },
];

export const NAV_STANDALONE: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, phase: 1 },
  { href: "/projects", label: "Projects", icon: FolderKanban, phase: 5 },
  { href: "/analytics", label: "Analytics", icon: LineChart, phase: 8 },
  { href: "/advisor", label: "AI Advisor", icon: Sparkles, phase: 9 },
  { href: "/settings", label: "Settings", icon: Settings, phase: 1 },
];

export const TOTAL_PHASES = 9;
