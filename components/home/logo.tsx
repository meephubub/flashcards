import Image from 'next/image';

export const Logo = () => (
  <div className="flex items-center gap-2 select-none">
    <Image src="/favicon.ico" alt="Logo" width={32} height={32} className="rounded" />
    <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">Flashcards</span>
  </div>
);

export default Logo; 