// Instagram highlight stories: rendered from design/templates/stories.html by scripts/render-stories.cjs
// into /assets/stories/<id>-<n>.jpg (and <id>-cover.jpg). Shared by the admin page and its API.
export const STORY_SETS = [
  { id: 'about', name: 'من نحن', count: 3 },
  { id: 'services', name: 'خدماتنا', count: 3 },
  { id: 'process', name: 'كيف نشتغل', count: 3 },
  { id: 'mizan', name: 'ميزان', count: 3 },
  { id: 'madar', name: 'مدار', count: 3 },
  { id: 'start', name: 'ابدأ', count: 3 },
];

export const storyFiles = (set) => Array.from({ length: set.count }, (_, i) => `/assets/stories/${set.id}-${i + 1}.jpg`);
export const storyCover = (set) => `/assets/stories/${set.id}-cover.jpg`;
