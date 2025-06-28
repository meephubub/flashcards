import Image from 'next/image';
import Link from 'next/link';

export const Logo = () => (
  <Link href="/" className="flex items-center gap-3 select-none group">
    <div className="relative w-8 h-8">
      <Image 
        src="/favicon.ico" 
        alt="Flashcards Logo" 
        width={32} 
        height={32} 
        className="rounded-md object-contain"
        priority
      />
    </div>
    <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white group-hover:text-black dark:group-hover:text-gray-200 transition-colors">
      Flashcards
    </span>
  </Link>
);

export default Logo; 