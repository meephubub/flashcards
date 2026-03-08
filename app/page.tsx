import { Metadata } from 'next'
import HomeClient from '@/components/home-page-client'

export const metadata: Metadata = {
  title: 'Decks',
}

export default function Home() {
  return <HomeClient />
}
