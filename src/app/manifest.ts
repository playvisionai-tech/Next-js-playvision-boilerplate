import type { MetadataRoute } from 'next';
import { appManifest } from '@/lib/pwa/manifest';

export default function manifest(): MetadataRoute.Manifest {
  return appManifest();
}
