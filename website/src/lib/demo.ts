/* Demo content — clearly labelled. No real patient data, no real medical findings. */

export interface DemoArticle {
  id: string
  title: string
  category: string
  minutes: number
  excerpt: string
  body: string[]
}

export interface DemoDoctor {
  id: string
  name: string
  specialty: string
  hospital: string
  experience: string
  rating: number
  nextSlot: string
}

export interface DemoInsight {
  id: string
  title: string
  value: string
  range: string
  note: string
}

export const DEMO_ARTICLES: DemoArticle[] = [
  {
    id: 'hydration',
    title: 'How much water do you actually need?',
    category: 'Wellness',
    minutes: 4,
    excerpt: 'The "8 glasses" rule is a rough average. What actually matters is your body weight, activity and climate.',
    body: [
      'You may have heard the "8 glasses a day" rule. In reality, hydration needs vary with body weight, activity level, weather, and diet.',
      'A simple guide: if your urine is pale yellow, you are likely well hydrated. Dark yellow suggests you need more fluids.',
      'This is general wellness information, not medical advice. For personalised guidance, consult your doctor.',
    ],
  },
  {
    id: 'vitamin-d',
    title: 'Understanding Vitamin D tests',
    category: 'Lab reports',
    minutes: 5,
    excerpt: 'What the 25(OH)D test measures, what ranges labs usually print, and when to speak to a doctor.',
    body: [
      'Most labs measure 25-hydroxyvitamin D, written as 25(OH)D, to estimate vitamin D status.',
      'Labs print their own reference ranges — always read your result against the range printed on YOUR report.',
      'If your value is outside the printed range, that alone is not a diagnosis. Discuss it with your doctor, who can interpret it with your history and symptoms.',
      'This is educational demo content, not medical advice.',
    ],
  },
  {
    id: 'sleep',
    title: 'Sleep and your heart',
    category: 'Wellness',
    minutes: 3,
    excerpt: 'Consistent sleep timing matters as much as sleep duration for cardiovascular health.',
    body: [
      'Research increasingly links irregular sleep schedules with higher cardiovascular risk — timing matters, not just hours.',
      'Simple habits: fixed wake time, morning light exposure, and avoiding heavy caffeine late in the day.',
      'Educational demo content. Speak to a clinician for personal concerns.',
    ],
  },
  {
    id: 'bp-reading',
    title: 'Reading a blood pressure report',
    category: 'Lab reports',
    minutes: 4,
    excerpt: 'Systolic vs diastolic, what the numbers mean, and why one high reading is not a diagnosis.',
    body: [
      'Blood pressure is written as systolic over diastolic, e.g. 120/80 mmHg.',
      'A single elevated reading can be caused by stress, caffeine, or even "white coat" anxiety at the clinic. Trends matter more than one number.',
      'Home readings over several days, taken seated and rested, give your doctor a better picture.',
      'Demo content — not medical advice.',
    ],
  },
  {
    id: 'hba1c',
    title: 'What is HbA1c?',
    category: 'Lab reports',
    minutes: 5,
    excerpt: 'The HbA1c test reflects your average blood sugar over roughly 3 months. Here is how to read it.',
    body: [
      'HbA1c measures the percentage of haemoglobin that has glucose attached — a proxy for average blood sugar over about three months.',
      'Reference ranges differ slightly between labs; read your value against the range on your report.',
      'Only a doctor can interpret results alongside your history. This article is demo educational content.',
    ],
  },
  {
    id: 'posture',
    title: 'Desk posture micro-habits',
    category: 'Wellness',
    minutes: 3,
    excerpt: 'Small breaks beat perfect posture. Three habits that reduce long sitting strain.',
    body: [
      'There is no single "perfect" posture — the best posture is your next one. Movement variety matters most.',
      'Try: stand or walk for 2–3 minutes every hour, keep the screen at eye level, and gently move your neck and shoulders a few times a day.',
      'Demo content. If you have persistent pain, consult a professional.',
    ],
  },
]

export const DEMO_DOCTORS: DemoDoctor[] = [
  { id: 'd1', name: 'Dr. Meera Sharma', specialty: 'General Physician', hospital: 'CityCare Clinic', experience: '12 yrs', rating: 4.8, nextSlot: 'Today · 5:30 PM' },
  { id: 'd2', name: 'Dr. Arjun Verma', specialty: 'Cardiologist', hospital: 'Heartline Institute', experience: '15 yrs', rating: 4.9, nextSlot: 'Tomorrow · 11:00 AM' },
  { id: 'd3', name: 'Dr. Sofia Khan', specialty: 'Endocrinologist', hospital: 'MetroHealth', experience: '9 yrs', rating: 4.7, nextSlot: 'Tomorrow · 4:00 PM' },
  { id: 'd4', name: 'Dr. Rajan Iyer', specialty: 'Orthopaedist', hospital: 'OrthoPlus Centre', experience: '18 yrs', rating: 4.8, nextSlot: 'Mon · 10:00 AM' },
]

export const DEMO_INSIGHTS: DemoInsight[] = [
  {
    id: 'i1',
    title: 'Vitamin D slightly below range',
    value: '22 ng/mL (demo value)',
    range: 'Typical lab range: 30–100 ng/mL',
    note: 'This is sample demo insight text shown to demonstrate how real AI-generated insights would appear here once an AI service is connected. Always discuss results with your doctor.',
  },
  {
    id: 'i2',
    title: 'Resting heart rate trend',
    value: 'Average 74 bpm (demo value)',
    range: 'Example reference: 60–100 bpm',
    note: 'Demo insight. When the AI backend is connected, this card will summarize actual values from your uploaded reports.',
  },
]

export const QUICK_QUESTIONS = [
  'Explain my latest report in simple words',
  'What does HbA1c mean?',
  'How do I read blood pressure numbers?',
  'What is a lipid profile?',
]
