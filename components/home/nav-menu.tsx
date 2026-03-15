import Link from 'next/link';
import { User } from 'lucide-react';

export const NavMenu = ({ className = '' }) => (
  <ul className={`flex gap-6 items-center ${className}`}>
    <li>
      <Link href="/" className="text-gray-700 dark:text-gray-200 hover:text-primary transition-colors font-medium">Home</Link>
    </li>
    <li>
      <Link href="/decks" className="text-gray-700 dark:text-gray-200 hover:text-primary transition-colors font-medium">Decks</Link>
    </li>
    <li>
      <Link href="/notes" className="text-gray-700 dark:text-gray-200 hover:text-primary transition-colors font-medium">Notes</Link>
    </li>
    <li>
      <Link href="/account" className="flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-primary transition-colors font-medium">
        <User className="h-4 w-4" />
        Account
      </Link>
    </li>
  </ul>
);

export default NavMenu;