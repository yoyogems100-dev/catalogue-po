import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
export type SizeChartSection = { name:string; image:string|null; rows:{size:string;diamondEquivalentCt:number|null;priceInr?:number|null}[] };
const css=StyleSheet.create({
 page:{padding:30,paddingBottom:45,fontFamily:'Helvetica',color:'#12233f',fontSize:9},
 header:{borderBottomWidth:2,borderBottomColor:'#c9a94e',paddingBottom:12,marginBottom:12},brand:{fontSize:23,fontFamily:'Helvetica-Bold'},title:{fontSize:16,marginTop:6},note:{fontSize:8,color:'#62666d',lineHeight:1.5,marginTop:6},
 columns:{flexDirection:'row',gap:12},section:{width:'31.8%'},name:{fontFamily:'Helvetica-Bold',fontSize:12,marginBottom:6},image:{width:140,height:120,objectFit:'contain',alignSelf:'center',marginBottom:10},
 row:{flexDirection:'row',paddingVertical:5,borderBottomWidth:0.5,borderBottomColor:'#ddd'},cell:{width:'57%',paddingLeft:7},weight:{width:'43%',textAlign:'center'},tableHead:{backgroundColor:'#12233f',color:'#fff',fontSize:8},
 footer:{position:'absolute',bottom:20,left:30,right:30,fontSize:8,color:'#62666d',borderTopWidth:0.5,borderTopColor:'#ddd',paddingTop:8,flexDirection:'row',justifyContent:'space-between'}
});
export default function SizeChartDocument({sections,categoryName='Moissanite',includePrices=false}:{sections:SizeChartSection[];categoryName?:string;includePrices?:boolean}){
 const chunks=sections.flatMap(s=>Array.from({length:Math.ceil(s.rows.length/22)},(_,i)=>({...s,name:s.name+(i?' (continued)':''),rows:s.rows.slice(i*22,(i+1)*22)})));
 const pages=Array.from({length:Math.ceil(chunks.length/3)},(_,i)=>chunks.slice(i*3,(i+1)*3));
 return <Document title={`YOYO GEMS - ${categoryName} ${includePrices ? 'price list' : 'shapes and sizes'}`} author="YOYO GEMS">
  {pages.map((group,page)=><Page key={page} size="A4" style={css.page}>
   <View style={css.header}><Text style={css.brand}>YOYO GEMS</Text><Text style={css.title}>{categoryName} | {includePrices ? 'Price list' : 'Shape & size chart'}</Text><Text style={css.note}>White (DEF)  |  Dimensions in millimetres  |  Reference images are not to scale</Text><Text style={css.note}>DEW (ct) = approximate diamond-equivalent weight from the supplied chart, not actual Moissanite weight. Availability is confirmed by our team.</Text></View>
   {includePrices && <Text style={{fontSize:8,color:'#9C7A25',marginBottom:10}}>INR (Rs.) per piece | On request = price not entered yet</Text>}
   <View style={css.columns}>{group.map((s,i)=><View key={i} style={css.section}>
    <Text style={css.name}>{s.name==='Cushion Elongated'?'Long cushion':s.name}</Text>
    {s.image?<Image src={s.image} style={css.image}/>:<View style={css.image}><Text>Reference photo pending</Text></View>}
    <View style={[css.row,css.tableHead]}><Text style={[css.cell,includePrices?{width:'40%'}:{}]}>Size (mm)</Text><Text style={[css.weight,includePrices?{width:'25%'}:{}]}>DEW (ct)</Text>{includePrices && <Text style={{width:'35%',textAlign:'center'}}>INR / pc</Text>}</View>
    {s.rows.map((r,j)=><View key={j} style={[css.row,{backgroundColor:j%2?'#faf8f3':'#fff'}]}><Text style={[css.cell,includePrices?{width:'40%'}:{}]}>{r.size.replace(/x/g,' x ')}</Text><Text style={[css.weight,includePrices?{width:'25%'}:{}]}>{r.diamondEquivalentCt===null?'—':r.diamondEquivalentCt.toFixed(r.diamondEquivalentCt<0.1?3:2).replace(/0+$/,'').replace(/\.$/,'')}</Text>{includePrices && <Text style={{width:'35%',textAlign:'center',fontSize:8}}>{r.priceInr==null?'On request':r.priceInr.toLocaleString('en-IN',{maximumFractionDigits:2})}</Text>}</View>)}
   </View>)}</View>
   <View style={css.footer} fixed><Text>yoyogems.co.in  |  +91 9079914601  |  Jaipur</Text><Text>{page+1} / {pages.length}</Text></View>
  </Page>)}
 </Document>;
}
