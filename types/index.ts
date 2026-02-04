export interface DiagnosisData {
  location: 'taichung' | 'other'
  goals: string[]
  experience: string
  commitment: string
  budget: string
}

export interface ServicePlan {
  id: string
  name: string
  price: number
  features: string[]
  suitableFor: string[]
  location?: 'taichung' | 'all'
}

export interface Testimonial {
  id: string
  name: string
  role: string
  avatar?: string
  content: string
  result: string
  rating: number
  date: string
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  publishedAt: string
  tags: string[]
  readingTime: number
}

export interface ContactForm {
  name: string
  email: string
  phone?: string
  message: string
  service?: string
}

export interface AnalyticsEvent {
  event: string
  parameters?: Record<string, any>
  timestamp: number
}
