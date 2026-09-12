import React from 'react';
import {renderToBuffer} from '@react-pdf/renderer';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import chart from '../data/moissanite-chart.json';
import SizeChartDocument from '../lib/pdf/SizeChartDocument';
const sections=chart.map(s=>({...s,image:'data:image/png;base64,'+readFileSync('public'+s.image).toString('base64')}));
const result=await renderToBuffer(<SizeChartDocument sections={sections}/>);
mkdirSync('output/pdf',{recursive:true});writeFileSync('output/pdf/YOYO-GEMS-Moissanite-Shapes-Sizes.pdf',result);
