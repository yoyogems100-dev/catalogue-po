import React from 'react';
import { Text, View } from '@react-pdf/renderer';

/**
 * A faint diagonal YOYO GEMS across the middle of every page of a generated
 * document, the same mark every photo carries. Placed first in each <Page>
 * so the content draws over it, and `fixed` so it repeats on the pages a long
 * table spills onto. Light enough that every figure stays readable.
 */
export function PageWatermark({ landscape = false }: { landscape?: boolean }) {
  return (
    <View
      fixed
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text
        style={{
          fontFamily: 'Helvetica-Bold',
          fontSize: landscape ? 96 : 78,
          letterSpacing: 8,
          color: '#1B3A6B',
          opacity: 0.06,
          transform: 'rotate(-32deg)'
        }}
      >
        YOYO GEMS
      </Text>
    </View>
  );
}
