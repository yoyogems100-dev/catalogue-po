'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadCart, saveCart, mergeIntoCart, type CartItem } from '@/lib/cart-storage';

// "Repeat order" used to open its own composer page -- a second, older copy
// of the category-page builder that never got the reference-photo strip,
// the per-category cart grouping, or any field added since. Now it just
// merges that order's lines into the SAME shared cart every other page reads
// and writes, then lands on /po/cart -- the one current requirement screen.
export default function RepeatOrderRedirect({ seedItems }: { seedItems: CartItem[] }) {
  const router = useRouter();
  // React Strict Mode (dev only) mounts, unmounts and remounts this effect --
  // without this guard the merge ran twice and every quantity landed doubled.
  const seeded = useRef(false);

  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      if (seedItems.length > 0) {
        let cart = loadCart();
        for (const item of seedItems) cart = mergeIntoCart(cart, item);
        saveCart(cart);
      }
    }
    router.replace('/po/cart');
  }, [seedItems, router]);

  return <div className="po-empty" style={{ margin: '40px auto', textAlign: 'center' }}>Adding items to your cart…</div>;
}
