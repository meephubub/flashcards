'use client';
import dynamic from 'next/dynamic';

const EnvBanner = dynamic(() => import('@/components/env-banner'), { ssr: false });

export default function EnvBannerClient() {
  return <EnvBanner />;
}