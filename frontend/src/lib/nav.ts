import { ArrowLeftRight, AudioLines, BookOpen, Home, Star } from 'lucide-react'

export type Section = 'overview' | 'translate' | 'conversation' | 'learn' | 'saved' | 'settings'

export const navItems: { id: Section; label: string; icon: typeof Home }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: Home },
  { id: 'translate', label: 'مساحة الترجمة', icon: ArrowLeftRight },
  { id: 'conversation', label: 'محادثة مباشرة', icon: AudioLines },
  { id: 'learn', label: 'مركز التعلّم', icon: BookOpen },
  { id: 'saved', label: 'إشاراتي المحفوظة', icon: Star },
]

export const sectionLabel = (section: Section): string =>
  navItems.find(item => item.id === section)?.label ?? 'الإعدادات'
