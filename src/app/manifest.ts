import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'fina',
    short_name: 'fina',
    description: 'Personal money log',
    // Mở thẳng vào màn hình nhập. Đó là lý do app tồn tại.
    start_url: '/log',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3f3f2',
    theme_color: '#f3f3f2',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
