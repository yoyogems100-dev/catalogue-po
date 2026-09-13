import React from 'react';
import {renderToBuffer} from '@react-pdf/renderer';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import chart from '../data/moissanite-chart.json';
import SizeChartDocument from '../lib/pdf/SizeChartDocument';
async function main() {
  const logoUrl = `data:image/png;base64,${readFileSync('public/brand/yoyo-gems-pdf-wordmark.png').toString('base64')}`;
  const sections = chart.map((section) => ({
    ...section,
    image: `data:image/png;base64,${readFileSync(`public${section.image}`).toString('base64')}`,
  }));
  const result = await renderToBuffer(<SizeChartDocument sections={sections} logoUrl={logoUrl} />);
  mkdirSync('output/pdf', {recursive: true});
  writeFileSync('output/pdf/YOYO-GEMS-Moissanite-Shapes-Sizes.pdf', result);
}

void main();
