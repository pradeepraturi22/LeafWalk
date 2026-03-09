// app/sitemap.ts — auto-generated sitemap for Google indexing
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://leafwalk.in'
  const now = new Date()

  return [
    { url: base,                        lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/rooms`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/gallery`,           lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/experiences`,       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/food`,              lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/contact`,           lastModified: now, changeFrequency: 'yearly',  priority: 0.6 },
    { url: `${base}/booking`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/terms`,             lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/privacy`,           lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
