'use client';

import { Suspense, useEffect, useMemo, type ComponentProps } from 'react';
import { useSearchParams } from 'next/navigation';
import { describeSelection, parseSelection, searchOf, type Selection } from '@/lib/site/filters';
import CategoryView from './CategoryView';

type Props = Omit<ComponentProps<typeof CategoryView>, 'selection' | 'heading' | 'intro'>;

const NONE: Selection = { shape: [], size: [], colour: [], grade: [] };

// The category page is rendered once on the server, unfiltered, and cached.
// The filters in the address bar are applied here, in the browser, so a
// filtered view -- however many combinations a crawler tries -- costs the
// server nothing. The unfiltered page is the server HTML (Suspense fallback).
export default function FilteredCategoryView(props: Props) {
  const plain = describeSelection(props.page, NONE, props.options);
  return (
    <Suspense fallback={<CategoryView {...props} selection={NONE} heading={plain.heading} intro={plain.intro} />}>
      <FromAddress {...props} />
    </Suspense>
  );
}

function FromAddress(props: Props) {
  const params = useSearchParams();
  const key = params.toString();
  const { page, options, global } = props;
  const selection = useMemo(() => parseSelection(searchOf(params), options), [key, options]); // eslint-disable-line react-hooks/exhaustive-deps
  const { heading, intro } = describeSelection(page, selection, options, global.filters || {});

  // Shape, colour and grade cards link to "...#stones". The photo section
  // moves to the top on a filtered view, so scroll once it has re-rendered.
  useEffect(() => {
    if (window.location.hash === '#stones') document.getElementById('stones')?.scrollIntoView({ block: 'start' });
  }, [key]);

  return <CategoryView {...props} selection={selection} heading={heading} intro={intro} />;
}
